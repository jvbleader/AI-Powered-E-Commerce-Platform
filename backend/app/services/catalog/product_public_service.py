from typing import List, Optional
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
import repositories.catalog.product_repository as product_repo
from schemas.catalog.product_public_schema import (
    ProductPublicResponse,
    ProductDetailPublicResponse,
    ProductListResponse,
)
import logging
import services.search.search_service as search_svc

logger = logging.getLogger(__name__)


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
    from schemas.catalog.product_public_schema import (
        SellerInfo, ImagePublicResponse, VariantPublicResponse, InventoryPublicResponse
    )
    from schemas.catalog.category_public_schema import CategoryPublicResponse

    req = SearchRequest(
        q=keyword,
        category_slug=category_slug,
        shop_slug=shop_slug,
        seller_id=seller_id,
        min_price=min_price,
        max_price=max_price,
        min_rating=min_rating,
        pickup_address=pickup_address,
        sort=sort_by,
        page=page,
        limit=size,
    )
    
    # 100% Elasticsearch Search Architecture
    es_response = await search_svc.search_products(req)

    product_public_ids = [doc.public_id for doc in es_response.items]
    primary_variants = await product_repo.get_primary_variants_by_product_public_ids(
        db, product_public_ids
    )
    
    # Map ES documents to ProductPublicResponse to satisfy API contract
    items = []
    for doc in es_response.items:
        seller_info = SellerInfo(
            id=doc.seller_id,
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
            # Fallback when variant data is unavailable; use product public_id so cart can resolve it.
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
                    inventory=InventoryPublicResponse(quantity=doc.total_stock, reserved_quantity=0) if doc.total_stock is not None else None
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
            
        product_resp = ProductPublicResponse(
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
        items.append(product_resp)

    return ProductListResponse(items=items, total=es_response.total, page=page, size=size, aggregations=es_response.aggregations)


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
