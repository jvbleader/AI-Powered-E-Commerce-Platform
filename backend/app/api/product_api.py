from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from core.database import get_db
import services.product_public_service as product_public_service
import repositories.seller_profile_repository as seller_profile_repo
from schemas.product_public_schema import (
    ProductPublicResponse,
    ProductDetailPublicResponse,
    ProductListResponse,
)
from dependencies.auth import get_current_user_optional

router = APIRouter(prefix="", tags=["Public Products"])


class ShopPublicDetailResponse(BaseModel):
    id: int
    shop_name: str
    shop_slug: str
    shop_logo_url: Optional[str] = None
    shop_description: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    pickup_address: Optional[str] = None
    shipping_fee: float = 0.0
    shipping_provider_name: Optional[str] = None
    status: str
    total_sold: int = 0
    product_count: int = 0
    average_rating: float = 0.0
    review_count: int = 0

    class Config:
        from_attributes = True


@router.get("/products", response_model=ProductListResponse)
async def get_products(
    keyword: Optional[str] = Query(None, description="Search by name or description"),
    category: Optional[str] = Query(None, description="Filter by category slug"),
    sort_by: Optional[str] = Query(
        None,
        description="Sort options: newest, price_asc, price_desc, best_selling, high_rating",
    ),
    min_price: Optional[float] = Query(None, description="Minimum price"),
    max_price: Optional[float] = Query(None, description="Maximum price"),
    seller_id: Optional[int] = Query(None, description="Filter by seller ID"),
    shop_slug: Optional[str] = Query(None, description="Filter by shop slug"),
    min_rating: Optional[float] = Query(None, description="Minimum average rating"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    return await product_public_service.get_public_product_list(
        db=db,
        keyword=keyword,
        category_slug=category,
        sort_by=sort_by,
        min_price=min_price,
        max_price=max_price,
        seller_id=seller_id,
        shop_slug=shop_slug,
        min_rating=min_rating,
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


@router.get("/shops/{shop_slug}", response_model=ShopPublicDetailResponse)
async def get_public_shop_detail(
    shop_slug: str, db: AsyncSession = Depends(get_db)
):
    seller = await seller_profile_repo.get_seller_profile_by_shop_slug(shop_slug, db)
    if not seller or seller.status != "APPROVED":
        raise HTTPException(status_code=404, detail="Shop not found or not active")
    
    stats = await seller_profile_repo.get_shop_stats(seller.id, db)
    
    return ShopPublicDetailResponse(
        id=seller.id,
        shop_name=seller.shop_name,
        shop_slug=seller.shop_slug,
        shop_logo_url=seller.shop_logo_url,
        shop_description=seller.shop_description,
        phone=seller.phone,
        email=seller.email,
        pickup_address=seller.pickup_address,
        shipping_fee=float(seller.shipping_fee or 0),
        shipping_provider_name=seller.shipping_provider_name,
        status=seller.status,
        total_sold=stats["total_sold"],
        product_count=stats["product_count"],
        average_rating=stats["average_rating"],
        review_count=stats["review_count"]
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

