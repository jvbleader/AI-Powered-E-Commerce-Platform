from pydantic import BaseModel
from decimal import Decimal

class AdminDashboardStatsResponse(BaseModel):
    total_revenue: Decimal
    total_users: int
    total_sellers: int
    pending_seller_applications: int
