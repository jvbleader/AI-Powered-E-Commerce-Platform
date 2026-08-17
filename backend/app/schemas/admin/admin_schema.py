from typing import List, Optional, Dict
from pydantic import BaseModel
from decimal import Decimal

class AdminDashboardStatsResponse(BaseModel):
    total_revenue: Decimal
    total_users: int
    total_sellers: int
    pending_seller_applications: int

class AdminTopProduct(BaseModel):
    id: str
    name: str
    image_url: Optional[str] = None
    sold_count: int
    revenue: Decimal
    price: Optional[Decimal] = None

class AdminTopSeller(BaseModel):
    id: str
    shop_name: str
    logo_url: Optional[str] = None
    total_orders: int
    total_revenue: Decimal

class AdminTimeSeriesData(BaseModel):
    date: str
    revenue: Decimal
    orders_count: int

class AdminPaymentBreakdown(BaseModel):
    cod_revenue: Decimal
    cod_count: int
    vnpay_revenue: Decimal
    vnpay_count: int

class AdminUserBreakdown(BaseModel):
    total_customers: int
    total_sellers: int
    total_supporters: int
    total_admins: int
    active_users: int
    locked_users: int

class AdminDetailedStatsResponse(BaseModel):
    total_revenue: Decimal
    pending_revenue: Decimal
    total_orders: int
    completed_orders: int
    cancelled_orders: int
    average_order_value: Decimal
    total_products: int
    active_products: int
    hidden_products: int
    total_categories: int
    user_breakdown: AdminUserBreakdown
    payment_breakdown: AdminPaymentBreakdown
    order_status_breakdown: Dict[str, int]
    daily_stats: List[AdminTimeSeriesData]
    monthly_stats: List[AdminTimeSeriesData]
    top_products: List[AdminTopProduct]
    top_sellers: List[AdminTopSeller]

