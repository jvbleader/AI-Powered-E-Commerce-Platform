from typing import Optional
from pydantic import BaseModel, Field


class PageViewEventRequest(BaseModel):
    path: str = Field(..., max_length=255)
    referrer: Optional[str] = Field(default=None, max_length=500)
    session_id: Optional[str] = Field(default=None, max_length=64)
    source_channel: Optional[str] = Field(default=None, max_length=50)
    device_type: Optional[str] = Field(default=None, max_length=20)


class PageViewEventResponse(BaseModel):
    status: str = "success"
