from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
from decimal import Decimal


class OrderResponse(BaseModel):
    public_id: str
    order_code: str
    order_status: str
    payment_status: str
    seller_confirmed: bool
    seller_confirmed_at: Optional[datetime]
    subtotal_amount: Decimal
    shipping_fee: Decimal
    product_discount_amount: Decimal
    shipping_discount_amount: Decimal
    total_amount: Decimal
    customer_note: Optional[str]
    payment_expires_at: datetime
    seller_confirm_expires_at: datetime
    completed_at: Optional[datetime]
    cancelled_at: Optional[datetime]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class OrderListResponse(BaseModel):
    items: List[OrderResponse]
    total: int
