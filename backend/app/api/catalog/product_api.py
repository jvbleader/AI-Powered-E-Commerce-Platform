from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from core.database import DBSession
import services.catalog.product_public_service as product_public_service
import repositories.seller.seller_profile_repository as seller_profile_repo
import services.search.search_log_service as search_log_svc
from schemas.catalog.product_public_schema import (
    ProductPublicResponse,
    ProductDetailPublicResponse,
    ProductListResponse,
)
from dependencies.auth import CurrentUserOptional

router = APIRouter(prefix="", tags=["Public Products"])


class ShippingProviderPublic(BaseModel):
    public_id: str
    name: str
    code: str
    fixed_fee: float
    logo_url: Optional[str] = None

class ShopPublicDetailResponse(BaseModel):
    id: int
    shop_name: str
    shop_slug: str
    shop_logo_url: Optional[str] = None
    shop_description: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    pickup_address: Optional[str] = None
    shipping_providers: List[ShippingProviderPublic] = []
    status: str
    total_sold: int = 0
    product_count: int = 0
    average_rating: float = 0.0
    review_count: int = 0
    approved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


@router.get("/products", response_model=ProductListResponse)
async def get_products(
    db: DBSession,
    background_tasks: BackgroundTasks,
    current_user: CurrentUserOptional,
    keyword: Optional[str] = Query(None, description="Search by name or description"),
    category: Optional[str] = Query(None, description="Filter by category slug"),
    sort_by: Optional[str] = Query(
        None,
        description="Sort options: newest, price_asc, price_desc, best_selling, high_rating",
    ),
    min_price: Optional[float] = Query(None, description="Minimum price"),
    max_price: Optional[float] = Query(None, description="Maximum price"),
    seller_id: Optional[str] = Query(None, description="Filter by seller ID or shop slug (comma separated)"),
    shop_slug: Optional[str] = Query(None, description="Filter by shop slug"),
    min_rating: Optional[float] = Query(None, description="Minimum average rating"),
    location: Optional[str] = Query(None, description="Filter by pickup address location"),
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
):
    result = await product_public_service.get_public_product_list(
        db=db,
        keyword=keyword,
        category_slug=category,
        sort_by=sort_by,
        min_price=min_price,
        max_price=max_price,
        seller_id=seller_id,
        shop_slug=shop_slug,
        min_rating=min_rating,
        pickup_address=location,
        page=page,
        size=size,
    )

    # Log search keyword to SearchLog (background, non-blocking)
    if keyword and keyword.strip():
        user_id = current_user.id if current_user else None
        background_tasks.add_task(
            search_log_svc.log_search,
            db=db,
            keyword=keyword.strip(),
            user_id=user_id,
            result_count=result.total,
        )

    return result


@router.get("/products/recommendations", response_model=List[ProductPublicResponse])
async def get_product_recommendations(
    current_user: CurrentUserOptional,
    db: DBSession,
    limit: int = Query(10, ge=1, le=50),
):
    user_id = current_user.id if current_user else None
    return await product_public_service.get_product_recommendations(
        db=db, user_id=user_id, limit=limit
    )

@router.get("/products/{product_slug}/similar", response_model=ProductListResponse)
async def get_similar_products(
    product_slug: str,
    db: DBSession,
    limit: int = Query(10, ge=1, le=50),
    page: int = Query(1, ge=1),
):
    """Có thể bạn cũng thích - Dựa trên sản phẩm hiện tại"""
    return await product_public_service.get_semantic_similar_products(
        db=db, product_slug=product_slug, limit=limit, page=page
    )

@router.get("/products/{product_slug}/shop-similar", response_model=ProductListResponse)
async def get_shop_similar_products(
    product_slug: str,
    db: DBSession,
    limit: int = Query(6, ge=1, le=50),
    page: int = Query(1, ge=1),
):
    """Các sản phẩm khác của shop - Dựa trên sản phẩm hiện tại"""
    return await product_public_service.get_semantic_shop_similar_products(
        db=db, product_slug=product_slug, limit=limit, page=page
    )


@router.get("/shops/featured", response_model=List[ShopPublicDetailResponse])
async def get_featured_shops(db: DBSession, limit: int = Query(10, ge=1, le=50)):
    shops = await seller_profile_repo.get_featured_shops(db, limit)
    result = []
    for seller in shops:
        stats = await seller_profile_repo.get_shop_stats(seller.id, db)
        result.append(
            ShopPublicDetailResponse(
                id=seller.id,
                shop_name=seller.shop_name,
                shop_slug=seller.shop_slug,
                shop_logo_url=seller.shop_logo_url,
                shop_description=seller.shop_description,
                phone=seller.phone,
                email=seller.email,
                pickup_address=seller.pickup_address,
                shipping_providers=[
                    ShippingProviderPublic(
                        public_id=p.public_id,
                        name=p.name,
                        code=p.code,
                        fixed_fee=float(p.fixed_fee),
                        logo_url=p.logo_url,
                    )
                    for p in (seller.shipping_providers or [])
                ],
                status=seller.status,
                total_sold=stats["total_sold"],
                product_count=stats["product_count"],
                average_rating=stats["average_rating"],
                review_count=stats["review_count"],
            )
        )
    return result

@router.get("/shops/{shop_slug}", response_model=ShopPublicDetailResponse)
async def get_public_shop_detail(
    shop_slug: str, db: DBSession
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
        shipping_providers=[
            ShippingProviderPublic(
                public_id=p.public_id,
                name=p.name,
                code=p.code,
                fixed_fee=float(p.fixed_fee),
                logo_url=p.logo_url,
            )
            for p in seller.shipping_providers
        ],
        status=seller.status,
        total_sold=stats["total_sold"],
        product_count=stats["product_count"],
        average_rating=stats["average_rating"],
        review_count=stats["review_count"],
        approved_at=seller.approved_at
    )


@router.get(
    "/shops/{shop_slug}/products/{product_slug}",
    response_model=ProductDetailPublicResponse,
)
async def get_product_detail(
    shop_slug: str, product_slug: str, db: DBSession
):
    return await product_public_service.get_public_product_detail(
        db=db, shop_slug=shop_slug, product_slug=product_slug
    )



