from __future__ import annotations

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class StageBreakdown(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    processing: float = 0.0
    in_transit: float = 0.0
    delivered_pending: float = 0.0


class PaymentMethodBreakdown(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    vnpay: float = 0.0
    cod: float = 0.0


class FinanceBreakdown(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    by_stage: StageBreakdown
    by_payment_method: PaymentMethodBreakdown


class PlatformFinanceSummaryResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    total_cash_inflow: float = 0.0
    total_cash_outflow: float = 0.0
    total_platform_held_liquidity: float = 0.0
    escrow_holding_balance: float
    total_shipping_fee_held: float = 0.0
    total_seller_available_balance: float
    total_platform_revenue: float
    total_payment_fee_collected: float
    total_commission_fee_collected: float
    total_payouts_disbursed: float
    total_refunded_amount: float = 0.0
    total_sellers_with_balance: int
    total_active_escrow_orders: int
    breakdown: FinanceBreakdown


class PlatformFinanceTransactionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    transaction_type: str
    amount: float
    escrow_before: float
    escrow_after: float
    revenue_before: float
    revenue_after: float
    order_id: Optional[int] = None
    payout_id: Optional[int] = None
    description: str
    created_at: datetime


class PaginatedPlatformFinanceTransactionsResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    items: List[PlatformFinanceTransactionResponse]
    total: int
    page: int
    page_size: int
