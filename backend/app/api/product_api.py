from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
import services.product_public_service as product_public_service
from schemas.product_public_schema import (
    ProductPublicResponse,
    ProductDetailPublicResponse,
    ProductListResponse,
)
from dependencies.auth import get_current_user_optional

router = APIRouter(prefix="/api/v1", tags=["Public Products"])


@router.get("/products", response_model=ProductListResponse)
async def get_products(
    keyword: Optional[str] = Query(None, description="Search by name or description"),
    category: Optional[str] = Query(None, description="Filter by category slug"),
    sort_by: Optional[str] = Query(
        None,
        description="Sort options: newest, price_asc, price_desc, best_selling, high_rating",
    ),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    return await product_public_service.get_public_product_list(
        db=db,
        keyword=keyword,
        category_slug=category,
        sort_by=sort_by,
        page=page,
        size=size,
    )


@router.get("/products/recommendations", response_model=List[ProductPublicResponse])
async def get_product_recommendations(
    limit: int = Query(10, ge=1, le=50),
    current_user=Depends(get_current_user_optional),
    db: AsyncSession = Depends(get_db),
):
    user_id = current_user.id if current_user else None
    return await product_public_service.get_product_recommendations(
        db=db, user_id=user_id, limit=limit
    )


@router.get(
    "/shops/{shop_slug}/products/{product_slug}",
    response_model=ProductDetailPublicResponse,
)
async def get_product_detail(
    shop_slug: str, product_slug: str, db: AsyncSession = Depends(get_db)
):
    return await product_public_service.get_public_product_detail(
        db=db, shop_slug=shop_slug, product_slug=product_slug
    )
