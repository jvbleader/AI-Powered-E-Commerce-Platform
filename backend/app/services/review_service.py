from typing import Optional
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

import repositories.review_repository as review_repo
from schemas.review_schema import ReviewCreate, ReviewResponse, ReviewListResponse, UserReviewInfo, UserReviewListResponse, UserReviewResponse, ProductReviewInfo

async def create_product_review(
    db: AsyncSession,
    user_id: int,
    data: ReviewCreate
) -> ReviewResponse:
    # 1. Verify order item exists, belongs to user, and order status is COMPLETED
    order_item = await review_repo.get_order_item_for_review(db, data.order_item_id, user_id)
    if not order_item:
        raise HTTPException(
            status_code=400,
            detail="Mục đơn hàng không tồn tại, không thuộc về bạn hoặc đơn hàng chưa hoàn thành."
        )

    if not order_item.product_id:
        raise HTTPException(
            status_code=400,
            detail="Sản phẩm cho mục đơn hàng này không còn tồn tại."
        )

    # 2. Check if already reviewed
    existing_review = await review_repo.get_review_by_order_item_id(db, data.order_item_id)
    if existing_review:
        raise HTTPException(
            status_code=400,
            detail="Mục đơn hàng này đã được đánh giá trước đó."
        )

    # 3. Create review
    review = await review_repo.create_review(
        db=db,
        user_id=user_id,
        product_id=order_item.product_id,
        order_item_id=data.order_item_id,
        rating=data.rating,
        comment=data.comment,
        images=data.images
    )

    return ReviewResponse.model_validate(review)

async def get_product_reviews(
    db: AsyncSession,
    product_id: str,
    page: int = 1,
    size: int = 20,
    rating: Optional[int] = None,
    has_image: Optional[bool] = None,
    variant_name: Optional[str] = None
) -> ReviewListResponse:
    skip = (page - 1) * size
    items, total, avg_rating = await review_repo.get_product_reviews(
        db=db,
        product_identifier=product_id,
        skip=skip,
        limit=size,
        rating=rating,
        has_image=has_image,
        variant_name=variant_name
    )

    review_responses = []
    for item in items:
        resp = ReviewResponse.model_validate(item)
        if item.user:
            resp.user = UserReviewInfo(
                id=item.user.id,
                full_name=item.user.full_name or "Người dùng",
                avatar_url=item.user.avatar_url
            )
        
        resp.images = [img.image_url for img in sorted(item.images, key=lambda x: x.sort_order)] if item.images else []
        resp.variant_name = item.order_item.variant_name_snapshot if item.order_item else None
        review_responses.append(resp)

    return ReviewListResponse(
        items=review_responses,
        total=total,
        page=page,
        size=size,
        average_rating=avg_rating
    )

async def get_user_reviews(
    db: AsyncSession,
    user_id: int,
    page: int = 1,
    size: int = 20
) -> UserReviewListResponse:
    skip = (page - 1) * size
    items, total = await review_repo.get_user_reviews(
        db=db,
        user_id=user_id,
        skip=skip,
        limit=size
    )

    review_responses = []
    for item in items:
        resp = UserReviewResponse.model_validate(item)
        
        if item.product:
            image_url = None
            if item.product.images and len(item.product.images) > 0:
                image_url = item.product.images[0].image_url
                
            resp.product = ProductReviewInfo(
                id=item.product.id,
                name=item.product.name,
                slug=item.product.slug,
                image_url=image_url
            )
            
        review_responses.append(resp)

    return UserReviewListResponse(
        items=review_responses,
        total=total,
        page=page,
        size=size
    )
