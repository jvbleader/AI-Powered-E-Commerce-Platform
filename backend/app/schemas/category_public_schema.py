from typing import Optional
from pydantic import BaseModel


class CategoryPublicResponse(BaseModel):
    id: int
    name: str
    slug: str
    sort_order: int
    is_default_other: bool

    class Config:
        from_attributes = True


class CategoryListResponse(BaseModel):
    categories: list[CategoryPublicResponse]
