from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field
from decimal import Decimal

class VariantCreateRequest(BaseModel):
    sku: str = Field(..., max_length=100)
    variant_name: str = Field(..., max_length=150)
    price: Decimal = Field(..., gt=0)
    sale_price: Optional[Decimal] = None
    sale_start_at: Optional[datetime] = None
    sale_end_at: Optional[datetime] = None
    image_url: Optional[str] = Field(None, max_length=500)
    quantity: int = Field(0, ge=0)

class ImageCreateRequest(BaseModel):
    image_url: str = Field(..., max_length=500)
    is_thumbnail: bool = False
    sort_order: int = 0

class ProductCreateRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    slug: str = Field(..., min_length=1, max_length=280)
    short_description: Optional[str] = Field(None, max_length=500)
    description: Optional[str] = None
    brand: Optional[str] = Field(None, max_length=120)
    origin: Optional[str] = Field(None, max_length=120)
    warranty_info: Optional[str] = Field(None, max_length=255)
    
    category_ids: List[int] = Field(default_factory=list)
    images: List[ImageCreateRequest] = Field(default_factory=list)
    variants: List[VariantCreateRequest] = Field(..., min_length=1)

class ProductUpdateRequest(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    slug: Optional[str] = Field(None, min_length=1, max_length=280)
    short_description: Optional[str] = Field(None, max_length=500)
    description: Optional[str] = None
    brand: Optional[str] = Field(None, max_length=120)
    origin: Optional[str] = Field(None, max_length=120)
    warranty_info: Optional[str] = Field(None, max_length=255)

class ImageResponse(BaseModel):
    image_url: str
    is_thumbnail: bool
    sort_order: int

    class Config:
        from_attributes = True

class VariantResponse(BaseModel):
    public_id: str
    sku: str
    variant_name: str
    price: Decimal
    sale_price: Optional[Decimal]
    sale_start_at: Optional[datetime]
    sale_end_at: Optional[datetime]
    image_url: Optional[str]
    status: str

    class Config:
        from_attributes = True

class ProductResponse(BaseModel):
    public_id: str
    name: str
    slug: str
    short_description: Optional[str]
    description: Optional[str]
    brand: Optional[str]
    origin: Optional[str]
    warranty_info: Optional[str]
    status: str
    average_rating: float
    review_count: int
    sold_count: int
    view_count: int
    created_at: datetime
    updated_at: Optional[datetime]
    
    # Adding the relations
    images: List[ImageResponse] = Field(default_factory=list)
    variants: List[VariantResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True

class ProductListResponse(BaseModel):
    items: List[ProductResponse]
    total: int
