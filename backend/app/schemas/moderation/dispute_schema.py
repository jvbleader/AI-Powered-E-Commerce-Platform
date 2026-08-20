from datetime import datetime
from typing import Any, List, Optional
from pydantic import BaseModel, ConfigDict, Field

from schemas.order.order_schema import OrderResponse, ShopInfo, UserInfo


class ResolveDisputeRequest(BaseModel):
    decision: str = Field(
        ...,
        description="Quyết định phân xử: APPROVE_REFUND (Đồng ý hoàn tiền) hoặc REJECT_DISPUTE (Bác bỏ khiếu nại)",
    )
    note: str = Field(
        ...,
        min_length=2,
        max_length=1000,
        description="Ghi chú / lý do phân xử của supporter",
    )


class DisputeResponse(BaseModel):
    id: int
    public_id: str
    return_code: str
    order_id: int
    user_id: int
    seller_id: int
    return_status: str
    reason: str
    description: str
    evidence_images: Optional[List[str]] = None
    seller_reject_reason: Optional[str] = None
    seller_responded_at: Optional[datetime] = None
    return_shipping_provider: Optional[str] = None
    return_tracking_code: Optional[str] = None
    pickup_address: Optional[str] = None
    return_address: Optional[str] = None
    dispute_reason: Optional[str] = None
    disputed_at: Optional[datetime] = None
    supporter_id: Optional[int] = None
    supporter_decision: Optional[str] = None
    supporter_note: Optional[str] = None
    resolved_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    order: Optional[OrderResponse] = None
    user: Optional[UserInfo] = None
    seller: Optional[ShopInfo] = None
    supporter: Optional[UserInfo] = None

    model_config = ConfigDict(from_attributes=True)


class DisputeListResponse(BaseModel):
    items: List[DisputeResponse]
    total: int
    skip: int = 0
    limit: int = 50

    model_config = ConfigDict(from_attributes=True)
