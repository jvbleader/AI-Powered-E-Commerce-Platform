from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models.catalog import Product
from models.catalog import ProductVariant
from models.seller import SellerProfile


def product_to_es_doc(product: Product, seller: SellerProfile | None = None) -> dict:
    """Convert a Product ORM object to an Elasticsearch document dict matching ProductSearchDocument."""
    seller_obj = seller or product.seller
    thumbnail = None
    if hasattr(product, "images") and product.images:
        thumb_img = next((img for img in product.images if img.is_thumbnail), None)
        thumbnail = (thumb_img or product.images[0]).image_url if product.images else None

    min_price = 0.0
    max_price = 0.0
    total_stock = 0
    
    if hasattr(product, "variants") and product.variants:
        active_variants = [v for v in product.variants if v.status != "DELETED"]
        if active_variants:
            prices = [
                float(v.sale_price) if v.sale_price is not None else float(v.price)
                for v in active_variants
            ]
            min_price = min(prices) if prices else 0.0
            max_price = max(prices) if prices else 0.0
            
            # Sum up inventory
            for v in active_variants:
                if hasattr(v, "inventory") and v.inventory:
                    total_stock += max(0, v.inventory.quantity - v.inventory.reserved_quantity)

    category_ids = []
    category_names = []
    category_slugs = []
    if hasattr(product, "categories") and product.categories:
        category_ids = [c.id for c in product.categories]
        category_names = [c.name for c in product.categories]
        category_slugs = [c.slug for c in product.categories]

    return {
        "id": product.id,
        "public_id": product.public_id,
        "slug": product.slug,
        "name": product.name,
        "short_description": product.short_description or "",
        "description": product.description or "",
        "category_ids": category_ids,
        "category_names": category_names,
        "category_slugs": category_slugs,
        "seller_id": seller_obj.id if seller_obj else 0,
        "shop_name": seller_obj.shop_name if seller_obj else "",
        "shop_slug": seller_obj.shop_slug if seller_obj else "",
        "pickup_address": seller_obj.pickup_address if seller_obj else "",
        "min_price": min_price,
        "max_price": max_price,
        "total_stock": total_stock,
        "in_stock": total_stock > 0,
        "average_rating": float(product.average_rating or 0),
        "review_count": product.review_count or 0,
        "sold_count": product.sold_count or 0,
        "status": product.status,
        "created_at": product.created_at.isoformat() if product.created_at else None,
        "thumbnail": thumbnail,
    }


async def fetch_all_active_products_for_indexing(db: AsyncSession) -> list[dict]:
    """Fetch all ACTIVE/OUT_OF_STOCK products with relationships for ES bulk indexing."""
    stmt = (
        select(Product)
        .join(SellerProfile, Product.seller_id == SellerProfile.id)
        .filter(
            Product.status.in_(["ACTIVE", "OUT_OF_STOCK"]),
            SellerProfile.status == "APPROVED",
        )
        .options(
            selectinload(Product.images),
            selectinload(Product.variants).selectinload(ProductVariant.inventory),
            selectinload(Product.seller),
            selectinload(Product.categories),
        )
    )
    result = await db.execute(stmt)
    products = list(result.scalars().unique().all())
    return [product_to_es_doc(p) for p in products]

async def sync_product_to_es(product_public_id: str) -> None:
    """Background task to fetch a product by public_id and index it into ES."""
    import logging
    import services.search_service as search_svc
    from core.database import AsyncSessionLocal
    
    logger = logging.getLogger(__name__)
    
    async with AsyncSessionLocal() as db:
        stmt = (
            select(Product)
            .where(Product.public_id == product_public_id)
            .options(
                selectinload(Product.images),
                selectinload(Product.variants).selectinload("inventory"),
                selectinload(Product.seller),
                selectinload(Product.categories),
            )
        )
        result = await db.execute(stmt)
        product = result.scalars().first()
        
        if product:
            doc = product_to_es_doc(product)
            await search_svc.index_product(doc)
        else:
            logger.warning(f"Product {product_public_id} not found for indexing.")

async def delete_product_from_es_by_public_id(product_public_id: str) -> None:
    """Background task to fetch a product by public_id and delete it from ES by its internal id."""
    import logging
    import services.search_service as search_svc
    from core.database import AsyncSessionLocal
    
    logger = logging.getLogger(__name__)
    
    async with AsyncSessionLocal() as db:
        stmt = select(Product.id).where(Product.public_id == product_public_id)
        result = await db.execute(stmt)
        product_id = result.scalars().first()
        
        if product_id:
            await search_svc.delete_product_from_index(product_id)
        else:
            logger.warning(f"Product {product_public_id} not found for deletion.")

async def update_products_in_es(product_ids: list[int]) -> None:
    """Background task to fetch multiple products by internal id and update/index them."""
    if not product_ids:
        return
        
    import logging
    import services.search_service as search_svc
    from core.database import AsyncSessionLocal
    
    logger = logging.getLogger(__name__)
    
    async with AsyncSessionLocal() as db:
        stmt = (
            select(Product)
            .where(Product.id.in_(product_ids))
            .options(
                selectinload(Product.images),
                selectinload(Product.variants).selectinload("inventory"),
                selectinload(Product.seller),
                selectinload(Product.categories),
            )
        )
        result = await db.execute(stmt)
        products = list(result.scalars().unique().all())
        
        docs = [product_to_es_doc(p) for p in products]
        if docs:
            await search_svc.bulk_index_products(docs)
            logger.info(f"Background CDC synced {len(docs)} products to ES.")

async def update_shop_in_es(seller_id: int) -> None:
    """Background task to update shop information in both Shop Index and Product Index (via update_by_query)."""
    import logging
    from core.database import AsyncSessionLocal
    from core.elasticsearch import get_es_client
    from search.indices import SHOP_INDEX_ALIAS, PRODUCT_INDEX_ALIAS
    
    logger = logging.getLogger(__name__)
    es = get_es_client()
    
    async with AsyncSessionLocal() as db:
        seller = await db.get(SellerProfile, seller_id)
        if not seller or seller.status != "APPROVED":
            # If not approved or deleted, maybe delete from Shop index?
            try:
                await es.delete(index=SHOP_INDEX_ALIAS, id=str(seller_id), ignore=[404])
            except Exception:
                pass
            return
            
        # 1. Update Shop Index
        from models.seller import SellerStatistics
        stats_res = await db.execute(select(SellerStatistics).where(SellerStatistics.seller_id == seller_id))
        stats = stats_res.scalar_one_or_none()
        
        total_sold = stats.total_sold if stats else 0
        from models.catalog import Product
        from sqlalchemy import func
        prod_count_res = await db.execute(select(func.count(Product.id)).where(Product.seller_id == seller_id, Product.status.in_(["ACTIVE", "OUT_OF_STOCK"])))
        product_count = prod_count_res.scalar() or 0
        
        shop_doc = {
            "id": seller.id,
            "public_id": seller.public_id,
            "shop_name": seller.shop_name,
            "shop_slug": seller.shop_slug,
            "shop_description": seller.shop_description or "",
            "total_sold": total_sold,
            "average_rating": 0.0,
            "review_count": 0,
            "product_count": product_count,
            "status": seller.status,
            "created_at": seller.created_at.isoformat() if seller.created_at else None,
            "shop_logo_url": seller.shop_logo_url
        }
        
        try:
            await es.index(
                index=SHOP_INDEX_ALIAS,
                id=str(seller.id),
                document=shop_doc,
            )
            logger.info(f"Synced Shop {seller.id} to ES.")
        except Exception:
            logger.exception(f"Failed to sync Shop {seller.id} to ES.")
            
        # 2. Update_By_Query for all products of this shop (Update shop_name and shop_slug)
        # WARNING: This is a heavy operation if the shop has > 100k products.
        try:
            await es.update_by_query(
                index=PRODUCT_INDEX_ALIAS,
                body={
                    "query": {
                        "term": {"seller_id": seller_id}
                    },
                    "script": {
                        "source": "ctx._source.shop_name = params.shop_name; ctx._source.shop_slug = params.shop_slug;",
                        "params": {
                            "shop_name": seller.shop_name,
                            "shop_slug": seller.shop_slug
                        }
                    }
                },
                conflicts="proceed"
            )
            logger.info(f"Executed Update_By_Query for Shop {seller.id} products.")
        except Exception:
            logger.exception(f"Failed Update_By_Query for Shop {seller.id} products.")
