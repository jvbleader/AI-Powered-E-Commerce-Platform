from typing import List, Optional
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
import repositories.product_repository as product_repo
from schemas.product_public_schema import (
    ProductPublicResponse,
    ProductDetailPublicResponse,
    ProductListResponse,
)
import logging
import services.search_service as search_svc

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
    from schemas.search import SearchRequest
    from schemas.product_public_schema import (
        SellerInfo, ImagePublicResponse, VariantPublicResponse, InventoryPublicResponse
    )
    from schemas.category_public_schema import CategoryPublicResponse

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
        # Frontend relies on variants to show price. 
        # We provide a dummy variant with min_price to satisfy the UI.
        variants.append(
            VariantPublicResponse(
                public_id="es-dummy",
                sku="es-dummy",
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
