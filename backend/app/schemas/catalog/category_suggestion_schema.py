from datetime import datetime
from typing import Optional
from pydantic import BaseModel, Field


class CategorySuggestionCreateRequest(BaseModel):
    suggested_name: str = Field(..., min_length=1, max_length=150, description="Tên danh mục đề xuất")
    reason: Optional[str] = Field(None, max_length=500, description="Lý do đề xuất")


class CategorySuggestionApproveRequest(BaseModel):
    name: Optional[str] = Field(None, max_length=150, description="Tên danh mục thực tế tạo")
    slug: Optional[str] = Field(None, max_length=180, description="Slug danh mục")
    sort_order: Optional[int] = Field(None, description="Thứ tự sắp xếp")
    is_default_other: bool = Field(False, description="Đặt làm danh mục mặc định khác")


class CategorySuggestionPublicResponse(BaseModel):
    id: int
    seller_id: int
    shop_name: Optional[str] = None
    shop_slug: Optional[str] = None
    suggested_name: str
    reason: Optional[str] = None
    status: str
    created_at: datetime
    resolved_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CategorySuggestionListResponse(BaseModel):
    suggestions: list[CategorySuggestionPublicResponse]
    total: int = 0
