from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel
from decimal import Decimal
from schemas.order.order_schema import OrderItemResponse, ShipmentResponse, UserInfo
from schemas.order.order_return_schema import OrderReturnResponse


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
    preferred_payment_method: Optional[str] = None
    payment_expires_at: datetime
    seller_confirm_expires_at: datetime
    completed_at: Optional[datetime]
    cancelled_at: Optional[datetime]
    delivered_at: Optional[datetime] = None
    auto_complete_at: Optional[datetime] = None
    return_tag: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime]
    print_count: int = 0
    user: Optional[UserInfo] = None
    items: List[OrderItemResponse] = []
    shipment: Optional[ShipmentResponse] = None
    return_request: Optional[OrderReturnResponse] = None

    class Config:
        from_attributes = True


class OrderListResponse(BaseModel):
    items: List[OrderResponse]
    total: int
