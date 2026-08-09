from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field

class UserReviewInfo(BaseModel):
    id: int
    full_name: str
    avatar_url: Optional[str] = None

    class Config:
        from_attributes = True

class ReviewCreate(BaseModel):
    order_item_id: int
    rating: int = Field(..., ge=1, le=5, description="Rating from 1 to 5")
    comment: Optional[str] = Field(None, max_length=2000)
    images: Optional[List[str]] = Field(None, max_items=4, description="List of image URLs (up to 4)")

class ReviewResponse(BaseModel):
    id: int
    user_id: int
    product_id: int
    order_item_id: int
    rating: int
    comment: Optional[str]
    created_at: datetime
    user: Optional[UserReviewInfo] = None
    images: List[str] = []
    variant_name: Optional[str] = None

    class Config:
        from_attributes = True

class ReviewListResponse(BaseModel):
    items: List[ReviewResponse]
    total: int
    page: int
    size: int
    average_rating: float = 0.0

    class Config:
        from_attributes = True

class ProductReviewInfo(BaseModel):
    id: int
    name: str
    slug: str
    image_url: Optional[str] = None

    class Config:
        from_attributes = True

class UserReviewResponse(ReviewResponse):
    product: Optional[ProductReviewInfo] = None

class UserReviewListResponse(BaseModel):
    items: List[UserReviewResponse]
    total: int
    page: int
    size: int

    class Config:
        from_attributes = True
