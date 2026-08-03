from __future__ import annotations

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models.product import Product
from models.product_variant import ProductVariant
from models.product_image import ProductImage
from models.seller_profile import SellerProfile


def product_to_es_doc(product: Product, seller: SellerProfile | None = None) -> dict:
    """Convert a Product ORM object to an Elasticsearch document dict."""
    seller_obj = seller or product.seller
    thumbnail = None
    if hasattr(product, "images") and product.images:
        thumb_img = next((img for img in product.images if img.is_thumbnail), None)
        thumbnail = (thumb_img or product.images[0]).image_url if product.images else None

    min_price = 0.0
    if hasattr(product, "variants") and product.variants:
        prices = [float(v.price) for v in product.variants if v.status != "DELETED"]
        min_price = min(prices) if prices else 0.0

    category_slugs = []
    if hasattr(product, "categories") and product.categories:
        category_slugs = [c.slug for c in product.categories]

    return {
        "id": product.id,
        "public_id": product.public_id,
        "name": product.name,
        "slug": product.slug,
        "shop_name": seller_obj.shop_name if seller_obj else "",
        "shop_slug": seller_obj.shop_slug if seller_obj else "",
        "shop_logo_url": seller_obj.shop_logo_url if seller_obj else None,
        "short_description": product.short_description or "",
        "min_price": min_price,
        "thumbnail_url": thumbnail,
        "category_slugs": category_slugs,
        "status": product.status,
        "sold_count": product.sold_count or 0,
        "average_rating": float(product.average_rating or 0),
        "review_count": product.review_count or 0,
        "created_at": product.created_at.isoformat() if product.created_at else None,
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
            selectinload(Product.variants),
            selectinload(Product.seller),
            selectinload(Product.categories),
        )
    )
    result = await db.execute(stmt)
    products = list(result.scalars().unique().all())
    return [product_to_es_doc(p) for p in products]
