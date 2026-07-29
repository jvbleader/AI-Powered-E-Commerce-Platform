from typing import List, Optional
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
import repositories.product_repository as product_repo
from schemas.product_public_schema import (
    ProductPublicResponse,
    ProductDetailPublicResponse,
    ProductListResponse,
)


async def get_public_product_list(
    db: AsyncSession,
    keyword: Optional[str] = None,
    category_slug: Optional[str] = None,
    sort_by: Optional[str] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    seller_id: Optional[int] = None,
    shop_slug: Optional[str] = None,
    min_rating: Optional[float] = None,
    page: int = 1,
    size: int = 20,
) -> ProductListResponse:
    skip = (page - 1) * size
    items, total = await product_repo.get_public_products(
        db=db,
        keyword=keyword,
        category_slug=category_slug,
        sort_by=sort_by,
        min_price=min_price,
        max_price=max_price,
        seller_id=seller_id,
        shop_slug=shop_slug,
        min_rating=min_rating,
        skip=skip,
        limit=size,
    )


    return ProductListResponse(items=items, total=total, page=page, size=size)


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
