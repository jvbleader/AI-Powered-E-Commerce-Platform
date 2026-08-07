from typing import Annotated
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import DBSession
from dependencies.auth import CurrentUser
from models.user import User
from schemas.review_schema import ReviewCreate, ReviewResponse, ReviewListResponse, UserReviewListResponse
import services.review_service as review_service

router = APIRouter(tags=["Product Reviews"])

from fastapi import APIRouter, Depends, Query, BackgroundTasks
from services.search_helpers import update_products_in_es

@router.post("/reviews", response_model=ReviewResponse)
async def create_review(
    data: ReviewCreate,
    user: CurrentUser,
    db: DBSession,
    background_tasks: BackgroundTasks
):
    try:
        review = await review_service.create_product_review(db=db, user_id=user.id, data=data)
        await db.commit()
        
        # Trigger ES sync
        if review.product_id:
            background_tasks.add_task(update_products_in_es, [review.product_id])
            
        return review
    except Exception:
        await db.rollback()
        raise

@router.get("/products/{product_id}/reviews", response_model=ReviewListResponse)
async def get_product_reviews(
    product_id: str,
    db: DBSession,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
):
    return await review_service.get_product_reviews(db=db, product_id=product_id, page=page, size=size)

@router.get("/reviews/me", response_model=UserReviewListResponse)
async def get_my_reviews(
    user: CurrentUser,
    db: DBSession,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
):
    return await review_service.get_user_reviews(db=db, user_id=user.id, page=page, size=size)
