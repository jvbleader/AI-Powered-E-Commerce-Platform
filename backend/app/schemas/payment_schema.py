from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field


class PaymentCreateRequest(BaseModel):
    order_codes: List[str] = Field(
        description="Danh sách order_code của các đơn hàng cần thanh toán"
    )
    payment_method: str = Field(description="BANK, MOMO, CREDIT_CARD, MOCK")


class PaymentOrderInfo(BaseModel):
    order_id: int
    amount: Decimal

    class Config:
        from_attributes = True


class PaymentResponse(BaseModel):
    public_id: str
    payment_code: str
    payment_method: str
    payment_gateway: Optional[str]
    payment_status: str
    amount: Decimal
    transaction_code: Optional[str]
    expires_at: datetime
    paid_at: Optional[datetime]
    failed_at: Optional[datetime]
    cancelled_at: Optional[datetime]
    created_at: datetime

    order_codes: List[str] = Field(
        default_factory=list, description="Danh sách order_code liên quan"
    )

    class Config:
        from_attributes = True


class MockPaymentCallbackRequest(BaseModel):
    payment_code: str
    status: str = Field(
        description="Trạng thái trả về từ mock gateway: PAID, FAILED, CANCELLED"
    )
    transaction_code: Optional[str] = Field(
        default=None, description="Mã giao dịch giả lập"
    )
