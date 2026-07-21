from typing import Annotated
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.auth import get_current_user
from models.user import User
from schemas.review_schema import ReviewCreate, ReviewResponse, ReviewListResponse
import services.review_service as review_service

router = APIRouter(tags=["Product Reviews"])

@router.post("/reviews", response_model=ReviewResponse)
async def create_review(
    data: ReviewCreate,
    user: Annotated[User, Depends(get_current_user)],
    db: AsyncSession = Depends(get_db)
):
    return await review_service.create_product_review(db=db, user_id=user.id, data=data)

@router.get("/products/{product_id}/reviews", response_model=ReviewListResponse)
async def get_product_reviews(
    product_id: str,
    page: int = Query(1, ge=1),
    size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db)
):
    return await review_service.get_product_reviews(db=db, product_id=product_id, page=page, size=size)

