from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field


class PaymentCreateRequest(BaseModel):
    order_codes: List[str] = Field(
        description="Danh sách order_code của các đơn hàng cần thanh toán"
    )
    payment_method: str = Field(description="BANK, MOMO, CREDIT_CARD, MOCK, VNPAY")


class VNPayPaymentCreateRequest(BaseModel):
    order_codes: List[str] = Field(
        description="Danh sách order_code của các đơn hàng cần thanh toán"
    )
    bank_code: Optional[str] = Field(
        default=None, description="Mã ngân hàng VNPay (tùy chọn)"
    )


class VNPayReturnResponse(BaseModel):
    signature_valid: bool
    payment_code: Optional[str]
    payment_status: Optional[str]
    vnp_response_code: Optional[str]
    vnp_transaction_status: Optional[str]
    display_success: bool
    message: str


class VNPayIpnResponse(BaseModel):
    RspCode: str
    Message: str


class VNPayQueryRequest(BaseModel):
    payment_code: str


class VNPayRefundRequest(BaseModel):
    payment_code: str
    amount: Optional[Decimal] = Field(
        default=None, description="Số tiền hoàn (mặc định toàn phần)"
    )
    reason: str = Field(min_length=1, max_length=500)
    partial: bool = False
    order_id: Optional[int] = None


class VNPayRefundResponse(BaseModel):
    refund_status: str
    amount: Decimal
    gateway_response: Optional[dict]


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


class VNPayPaymentCreateResponse(BaseModel):
    payment: PaymentResponse
    payment_url: str


class MockPaymentCallbackRequest(BaseModel):
    payment_code: str
    status: str = Field(
        description="Trạng thái trả về từ mock gateway: PAID, FAILED, CANCELLED"
    )
    transaction_code: Optional[str] = Field(
        default=None, description="Mã giao dịch giả lập"
    )
