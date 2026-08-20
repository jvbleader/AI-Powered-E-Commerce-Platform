from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field


class ReturnRequestCreate(BaseModel):
    reason: str = Field(..., min_length=2, max_length=100, description="Lý do yêu cầu trả hàng/hoàn tiền")
    description: str = Field(..., min_length=5, description="Mô tả chi tiết lý do trả hàng")
    evidence_images: Optional[List[str]] = Field(
        default=None, description="Danh sách URL hình ảnh/video bằng chứng"
    )


class ReturnRejectRequest(BaseModel):
    reject_reason: str = Field(..., min_length=2, description="Lý do Shop từ chối yêu cầu trả hàng")


class ReturnDisputeRequest(BaseModel):
    dispute_reason: str = Field(..., min_length=5, description="Lý do người mua khiếu nại lên Sàn")


class OrderReturnResponse(BaseModel):
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

    class Config:
        from_attributes = True
