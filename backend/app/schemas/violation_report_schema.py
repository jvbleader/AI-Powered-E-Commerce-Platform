from datetime import datetime
from typing import Optional, Union
from pydantic import BaseModel, ConfigDict, Field


class CreateViolationReportRequest(BaseModel):
    product_id: Union[int, str] = Field(..., description="ID hoặc Public ID của sản phẩm bị báo cáo")
    reason_type: str = Field(..., description="Loại lý do báo cáo")
    description: str = Field(..., description="Mô tả chi tiết vi phạm")
    image_urls: Optional[list[str]] = Field(default=[], description="Danh sách URL hình ảnh bằng chứng")


class ViolationReportImageResponse(BaseModel):
    id: int
    image_url: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class ViolationReportResponse(BaseModel):
    id: int
    reporter_id: int
    product_id: int
    product_public_id: Optional[str] = None
    reason_type: str
    description: str
    status: str
    created_at: datetime
    resolved_at: Optional[datetime] = None
    images: list[ViolationReportImageResponse] = []
    product_name: Optional[str] = None
    product_thumbnail: Optional[str] = None
    reporter_name: Optional[str] = None
    reporter_email: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class UpdateViolationReportStatusRequest(BaseModel):
    status: str = Field(..., description="Trạng thái mới: PENDING, REVIEWING, RESOLVED, REJECTED")
