from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from decimal import Decimal


class SellerInfo(BaseModel):
    shop_name: str
    shop_slug: str
    shop_logo_url: Optional[str] = None
    total_sold: int = 0

    class Config:
        from_attributes = True


class ImagePublicResponse(BaseModel):
    image_url: str
    is_thumbnail: bool
    sort_order: int

    class Config:
        from_attributes = True


class InventoryPublicResponse(BaseModel):
    quantity: int

    class Config:
        from_attributes = True


class VariantPublicResponse(BaseModel):
    public_id: str
    sku: str
    variant_name: str
    price: Decimal
    sale_price: Optional[Decimal]
    sale_start_at: Optional[datetime]
    sale_end_at: Optional[datetime]
    image_url: Optional[str]
    status: str

    # Nested inventory for stock check
    inventory: Optional[InventoryPublicResponse] = None
    tier_index: Optional[List[int]] = None

    class Config:
        from_attributes = True


from .category_public_schema import CategoryPublicResponse


class ProductPublicResponse(BaseModel):
    public_id: str
    name: str
    slug: str
    short_description: Optional[str]
    average_rating: float
    review_count: int
    sold_count: int
    view_count: int
    status: str

    seller: Optional[SellerInfo] = None
    images: List[ImagePublicResponse] = Field(default_factory=list)
    variants: List[VariantPublicResponse] = Field(default_factory=list)
    categories: List[CategoryPublicResponse] = Field(default_factory=list)
    variant_options: Optional[List[dict]] = None

    class Config:
        from_attributes = True


class ProductDetailPublicResponse(ProductPublicResponse):
    description: Optional[str]
    brand: Optional[str]
    origin: Optional[str]
    warranty_info: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ProductListResponse(BaseModel):
    items: List[ProductPublicResponse]
    total: int
    page: int
    size: int

    class Config:
        from_attributes = True
