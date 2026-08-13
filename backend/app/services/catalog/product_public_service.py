from typing import List, Optional
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
import repositories.catalog.product_repository as product_repo
from schemas.catalog.product_public_schema import (
    ProductPublicResponse,
    ProductDetailPublicResponse,
    ProductListResponse,
    SellerInfo,
    ImagePublicResponse,
    VariantPublicResponse,
    InventoryPublicResponse,
)
from schemas.catalog.category_public_schema import CategoryPublicResponse
import logging
import services.search.search_service as search_svc
from services.search.search_service import SearchBackendError

logger = logging.getLogger(__name__)


def _map_es_doc_to_public(
    doc,
    primary_variants: dict,
) -> ProductPublicResponse:
    seller_info = SellerInfo(
        id=doc.seller_id,
        public_id=getattr(doc, "seller_public_id", ""),
        shop_name=doc.shop_name,
        shop_slug=doc.shop_slug,
        pickup_address=getattr(doc, "pickup_address", ""),
    )
    images = []
    if doc.thumbnail:
        images.append(ImagePublicResponse(image_url=doc.thumbnail, is_thumbnail=True, sort_order=0))

    variants = []
    primary_variant = primary_variants.get(doc.public_id)
    if primary_variant:
        inventory = None
        if primary_variant.inventory:
            inventory = InventoryPublicResponse(
                quantity=primary_variant.inventory.quantity,
                reserved_quantity=primary_variant.inventory.reserved_quantity,
            )
        variants.append(
            VariantPublicResponse(
                public_id=primary_variant.public_id,
                sku=primary_variant.sku,
                variant_name=primary_variant.variant_name,
                price=primary_variant.price,
                sale_price=primary_variant.sale_price,
                sale_start_at=primary_variant.sale_start_at,
                sale_end_at=primary_variant.sale_end_at,
                image_url=primary_variant.image_url,
                status=primary_variant.status,
                inventory=inventory,
            )
        )
    else:
        variants.append(
            VariantPublicResponse(
                public_id=doc.public_id,
                sku="default",
                variant_name="Default",
                price=doc.min_price,
                sale_price=None,
                sale_start_at=None,
                sale_end_at=None,
                image_url=None,
                status="ACTIVE",
                inventory=InventoryPublicResponse(
                    quantity=doc.total_stock, reserved_quantity=0
                )
                if doc.total_stock is not None
                else None,
            )
        )

    categories = []
    for i in range(len(doc.category_ids)):
        categories.append(
            CategoryPublicResponse(
                id=doc.category_ids[i],
                name=doc.category_names[i] if i < len(doc.category_names) else "",
                slug=doc.category_slugs[i] if i < len(doc.category_slugs) else "",
                sort_order=0,
                is_default_other=False,
            )
        )

    return ProductPublicResponse(
        public_id=doc.public_id,
        name=doc.name,
        slug=doc.slug,
        short_description=doc.short_description,
        average_rating=doc.average_rating,
        review_count=doc.review_count,
        sold_count=doc.sold_count,
        status=doc.status,
        seller=seller_info,
        images=images,
        variants=variants,
        categories=categories,
    )


def _map_orm_product_to_public(product) -> ProductPublicResponse:
    seller = product.seller
    seller_info = None
    if seller:
        seller_info = SellerInfo(
            id=seller.id,
            shop_name=seller.shop_name,
            shop_slug=seller.shop_slug,
            pickup_address=getattr(seller, "pickup_address", None),
            shop_logo_url=getattr(seller, "shop_logo_url", None),
            shop_description=getattr(seller, "shop_description", None),
        )

    images = [
        ImagePublicResponse(
            image_url=img.image_url,
            is_thumbnail=bool(img.is_thumbnail),
            sort_order=img.sort_order or 0,
        )
        for img in (product.images or [])
    ]

    variants = []
    for v in product.variants or []:
        if getattr(v, "status", None) == "DELETED":
            continue
        inventory = None
        if v.inventory:
            inventory = InventoryPublicResponse(
                quantity=v.inventory.quantity,
                reserved_quantity=v.inventory.reserved_quantity,
            )
        variants.append(
            VariantPublicResponse(
                public_id=v.public_id,
                sku=v.sku,
                variant_name=v.variant_name,
                price=v.price,
                sale_price=v.sale_price,
                sale_start_at=v.sale_start_at,
                sale_end_at=v.sale_end_at,
                image_url=v.image_url,
                status=v.status,
                inventory=inventory,
            )
        )

    categories = [
        CategoryPublicResponse(
            id=c.id,
            name=c.name,
            slug=c.slug,
            sort_order=getattr(c, "sort_order", 0) or 0,
            is_default_other=bool(getattr(c, "is_default_other", False)),
        )
        for c in (product.categories or [])
    ]

    return ProductPublicResponse(
        public_id=product.public_id,
        name=product.name,
        slug=product.slug,
        short_description=product.short_description,
        average_rating=float(product.average_rating or 0),
        review_count=product.review_count or 0,
        sold_count=product.sold_count or 0,
        status=product.status,
        seller=seller_info,
        images=images,
        variants=variants,
        categories=categories,
    )


async def _mysql_fallback_list(
    db: AsyncSession,
    keyword: Optional[str],
    category_slug: Optional[str],
    sort_by: Optional[str],
    min_price: Optional[float],
    max_price: Optional[float],
    seller_id: Optional[str],
    shop_slug: Optional[str],
    min_rating: Optional[float],
    page: int,
    size: int,
) -> ProductListResponse:
    """Degraded listing path when Elasticsearch is unavailable."""
    seller_id_int = None
    effective_shop_slug = shop_slug
    if seller_id:
        parts = [p.strip() for p in seller_id.split(",") if p.strip()]
        if len(parts) == 1 and parts[0].isdigit():
            seller_id_int = int(parts[0])
        elif parts and all(p.isdigit() for p in parts):
            seller_id_int = int(parts[0])
        elif not effective_shop_slug:
            effective_shop_slug = parts[0] if parts else None

    skip = max(0, (page - 1) * size)
    products, total = await product_repo.get_public_products(
        db,
        keyword=keyword,
        category_slug=category_slug.split(",")[0].strip() if category_slug else None,
        sort_by=sort_by,
        min_price=min_price,
        max_price=max_price,
        seller_id=seller_id_int,
        shop_slug=effective_shop_slug.split(",")[0].strip() if effective_shop_slug else None,
        min_rating=min_rating,
        skip=skip,
        limit=size,
    )
    items = [_map_orm_product_to_public(p) for p in products]
    return ProductListResponse(items=items, total=total, page=page, size=size, aggregations={})


async def get_public_product_list(
    db: AsyncSession,
    keyword: Optional[str] = None,
    category_slug: Optional[str] = None,
    sort_by: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    seller_id: Optional[str] = None,
    shop_slug: Optional[str] = None,
    min_rating: Optional[float] = None,
    pickup_address: Optional[str] = None,
    page: int = 1,
    size: int = 20,
) -> ProductListResponse:
    from schemas.search.search_schema import SearchRequest

    req = SearchRequest(
        q=keyword,
        category_slug=category_slug,
        shop_slug=shop_slug,
        seller_id=seller_id,
        min_price=min_price,
        max_price=max_price,
        min_rating=min_rating,
        pickup_address=pickup_address,
        sort=sort_by or "relevance",
        page=page,
        limit=size,
    )

    try:
        es_response = await search_svc.search_products(req)
    except SearchBackendError as e:
        logger.warning(
            "Elasticsearch unavailable — falling back to MySQL listing: %s",
            e,
        )
        return await _mysql_fallback_list(
            db,
            keyword=keyword,
            category_slug=category_slug,
            sort_by=sort_by,
            min_price=min_price,
            max_price=max_price,
            seller_id=seller_id,
            shop_slug=shop_slug,
            min_rating=min_rating,
            page=page,
            size=size,
        )

    product_public_ids = [doc.public_id for doc in es_response.items]
    primary_variants = await product_repo.get_primary_variants_by_product_public_ids(
        db, product_public_ids
    )

    items = [_map_es_doc_to_public(doc, primary_variants) for doc in es_response.items]
    return ProductListResponse(
        items=items,
        total=es_response.total,
        page=page,
        size=size,
        aggregations=es_response.aggregations,
    )


async def get_public_product_detail(
    db: AsyncSession, shop_slug: str, product_slug: str
) -> ProductDetailPublicResponse:
    product = await product_repo.get_public_product_detail(db, shop_slug, product_slug)
    if not product:
        raise HTTPException(
            status_code=404, detail="Product not found or not available"
        )

    return product


async def get_product_recommendations(
    db: AsyncSession, user_id: Optional[int] = None, limit: int = 10
) -> List[ProductPublicResponse]:
    items = await product_repo.get_recommended_products(db, user_id, limit)
    return items

import services.search.recommendation_service as recommendation_service
from schemas.search.search_schema import ProductSearchDocument

async def get_semantic_similar_products(
    db: AsyncSession, product_slug: str, limit: int = 10, page: int = 1
) -> ProductListResponse:
    product = await product_repo.get_product_by_slug(db, product_slug)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    es_docs, total = await recommendation_service.get_similar_products(db, product, limit, page)
    
    # Cap total at 152 for semantic similar products as per requirements
    total = min(total, 152)

    docs = [ProductSearchDocument(**doc) for doc in es_docs]
    product_public_ids = [doc.public_id for doc in docs]
    primary_variants = await product_repo.get_primary_variants_by_product_public_ids(
        db, product_public_ids
    )

    items = [_map_es_doc_to_public(doc, primary_variants) for doc in docs]
    return ProductListResponse(
        items=items,
        total=total,
        page=page,
        size=limit,
        aggregations={},
    )

async def get_semantic_shop_similar_products(
    db: AsyncSession, product_slug: str, limit: int = 6, page: int = 1
) -> ProductListResponse:
    product = await product_repo.get_product_by_slug(db, product_slug)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    es_docs, total = await recommendation_service.get_shop_similar_products(
        db, product, limit, page
    )
    docs = [ProductSearchDocument(**doc) for doc in es_docs]
    product_public_ids = [doc.public_id for doc in docs]
    primary_variants = await product_repo.get_primary_variants_by_product_public_ids(
        db, product_public_ids
    )

    items = [_map_es_doc_to_public(doc, primary_variants) for doc in docs]
    return ProductListResponse(
        items=items,
        total=total,
        page=page,
        size=limit,
        aggregations={},
    )

async def get_today_suggestions(
    db: AsyncSession, keywords: List[str], limit: int = 48, page: int = 1
) -> ProductListResponse:
    # Get products from recommendation service
    es_docs, total = await recommendation_service.get_suggestions_by_keywords(
        db, keywords, limit, page
    )
    
    docs = [ProductSearchDocument(**doc) for doc in es_docs]
    product_public_ids = [doc.public_id for doc in docs]
    primary_variants = await product_repo.get_primary_variants_by_product_public_ids(
        db, product_public_ids
    )

    items = [_map_es_doc_to_public(doc, primary_variants) for doc in docs]
    return ProductListResponse(
        items=items,
        total=total,
        page=page,
        size=limit,
        aggregations={},
    )
