from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime

class SearchRequest(BaseModel):
    q: Optional[str] = None
    category_slug: Optional[str] = None
    category_id: Optional[int] = None
    shop_slug: Optional[str] = None
    seller_id: Optional[str] = None
    brand: Optional[str] = None
    min_price: Optional[float] = None
    max_price: Optional[float] = None
    min_rating: Optional[float] = None
    pickup_address: Optional[str] = None
    in_stock: Optional[bool] = None
    # Canonical: relevance, newest, best_selling, high_rating, price_asc, price_desc
    # Aliases accepted by strategy: latest, sales, sold_count, rating
    sort: Optional[str] = "relevance"
    page: int = Field(default=1, ge=1)
    limit: int = Field(default=20, ge=1, le=100)

class ProductSearchDocument(BaseModel):
    id: int
    public_id: str
    slug: str
    name: str
    short_description: Optional[str] = None
    description: Optional[str] = None
    brand_name: Optional[str] = None
    category_ids: List[int] = []
    category_names: List[str] = []
    category_slugs: List[str] = []
    seller_id: int
    shop_name: str
    shop_slug: str
    pickup_address: Optional[str] = None
    price: Optional[float] = None
    min_price: float
    max_price: float
    total_stock: int
    in_stock: bool
    average_rating: float
    review_count: int
    sold_count: int
    status: str
    created_at: datetime
    thumbnail: Optional[str] = None

class SearchResponse(BaseModel):
    total: int
    page: int
    limit: int
    items: List[ProductSearchDocument]
    aggregations: dict = Field(default_factory=dict)

class ShopSearchRequest(BaseModel):
    q: Optional[str] = None
    min_rating: Optional[float] = None
    sort: Optional[str] = "relevance"  # relevance, newest, high_rating, product_count
    page: int = Field(default=1, ge=1)
    limit: int = Field(default=20, ge=1, le=100)

class ShopSearchDocument(BaseModel):
    id: int
    public_id: str
    shop_name: str
    shop_slug: str
    shop_description: Optional[str] = None
    total_sold: int
    average_rating: float
    review_count: int
    product_count: int
    status: str
    created_at: datetime
    shop_logo_url: Optional[str] = None

class ShopSearchResponse(BaseModel):
    total: int
    page: int
    limit: int
    items: List[ShopSearchDocument]
