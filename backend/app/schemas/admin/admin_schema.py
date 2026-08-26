from typing import List, Optional, Dict, Any
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

class AdminUserGrowthPoint(BaseModel):
    date: str
    count: int

class AdminUserGrowthResponse(BaseModel):
    total_users: int
    weekly: List[AdminUserGrowthPoint]
    monthly: List[AdminUserGrowthPoint]


from schemas.catalog.product_public_schema import ProductDetailPublicResponse

class AdminProductListResponse(BaseModel):
    items: List[ProductDetailPublicResponse]
    total: int
    page: int
    limit: int
    total_pages: int


# ==========================================
# Comprehensive Dashboard & Action Center
# ==========================================

class AdminActionCountsResponse(BaseModel):
    pending_seller_applications: int = 0
    pending_violation_reports: int = 0
    pending_category_suggestions: int = 0
    pending_disputes: int = 0
    failed_payment_orders: int = 0

class AdminKpiDelta(BaseModel):
    current_value: Decimal | float | int
    previous_value: Decimal | float | int
    delta_pct: Optional[float] = None

class AdminHeroKpisResponse(BaseModel):
    revenue: AdminKpiDelta
    orders: AdminKpiDelta
    new_users: AdminKpiDelta
    new_sellers: AdminKpiDelta
    products: AdminKpiDelta

class AdminMicroKpisResponse(BaseModel):
    return_rate: AdminKpiDelta
    aov: AdminKpiDelta
    total_visits: AdminKpiDelta
    conversion_rate: AdminKpiDelta
    total_reviews: AdminKpiDelta

class AdminRevenueSeriesPoint(BaseModel):
    label: str
    full_date: str
    current_revenue: Decimal
    previous_revenue: Decimal
    current_orders: int
    previous_orders: int

class AdminOrderStatusDonutItem(BaseModel):
    status: str
    label: str
    count: int
    percentage: float
    color: str

class AdminUserGrowthSeriesPoint(BaseModel):
    label: str
    new_users: int
    active_users: int

class AdminTrafficSourceItem(BaseModel):
    channel: str
    label: str
    count: int
    percentage: float
    color: str

class AdminFinanceDonutItem(BaseModel):
    key: str
    label: str
    amount: float
    percentage: float
    color: str

class AdminPlatformFinanceOverview(BaseModel):
    total_held_liquidity: float = 0.0
    total_cash_inflow: float = 0.0
    total_cash_outflow: float = 0.0
    escrow_holding: float = 0.0
    shipping_held: float = 0.0
    seller_wallets: float = 0.0
    platform_revenue: float = 0.0
    payouts_disbursed: float = 0.0
    chart_items: List[AdminFinanceDonutItem] = []

class AdminPaymentDonutItem(BaseModel):
    channel: str
    label: str
    revenue: Decimal
    count: int
    percentage: float
    color: str

class AdminTopCategory(BaseModel):
    rank: int
    id: str | int
    name: str
    revenue: Decimal
    percentage: float

class AdminTopSellerDetailed(BaseModel):
    rank: int
    id: str
    name: str
    logo_url: Optional[str] = None
    revenue: Decimal
    products_count: int
    rating: float

class AdminTopProductDetailed(BaseModel):
    rank: int
    id: str
    name: str
    image_url: Optional[str] = None
    seller_name: str
    sold_count: int
    revenue: Decimal

class AdminDemographicsResponse(BaseModel):
    devices: Dict[str, Any]
    age_groups: List[Dict[str, Any]]
    gender: Dict[str, Any]

class AdminSystemAlertItem(BaseModel):
    id: str
    type: str # 'warning' | 'danger' | 'info' | 'success'
    title: str
    description: str
    time_ago: str
    action_url: Optional[str] = None

class AdminRecentActivityItem(BaseModel):
    id: str
    time: str
    action: str
    target: str
    actor: str

class AdminHourlyHeatmapCell(BaseModel):
    day_of_week: int # 0 (Mon) .. 6 (Sun)
    day_label: str # 'T2' .. 'CN'
    hour: int # 0 .. 23
    intensity: int # 0 .. 100
    count: int

class AdminBottomSummary(BaseModel):
    year: int
    total_revenue_ytd: Decimal
    total_orders_ytd: int
    total_users: int
    total_sellers: int
    total_products: int

class AdminComprehensiveDashboardResponse(BaseModel):
    hero_kpis: AdminHeroKpisResponse
    micro_kpis: AdminMicroKpisResponse
    revenue_chart: List[AdminRevenueSeriesPoint]
    order_status_donut: List[AdminOrderStatusDonutItem]
    total_orders_count: int
    user_growth_chart: List[AdminUserGrowthSeriesPoint]
    traffic_sources: List[AdminTrafficSourceItem]
    total_visits_count: int
    payment_breakdown: List[AdminPaymentDonutItem] = []
    total_payment_revenue: Decimal = Decimal("0")
    finance_overview: Optional[AdminPlatformFinanceOverview] = None
    top_categories: List[AdminTopCategory]
    top_sellers: List[AdminTopSellerDetailed]
    demographics: AdminDemographicsResponse
    top_products: List[AdminTopProductDetailed]
    system_alerts: List[AdminSystemAlertItem]
    hourly_heatmap: List[AdminHourlyHeatmapCell]
    recent_activities: List[AdminRecentActivityItem]
    bottom_summary: AdminBottomSummary

