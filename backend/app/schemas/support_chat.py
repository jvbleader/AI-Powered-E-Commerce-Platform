from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, ConfigDict


class SupportMessageBase(BaseModel):
    content: str


class SupportMessageCreate(SupportMessageBase):
    sender_type: str


class SupportMessageResponse(SupportMessageBase):
    id: int
    conversation_id: str
    sender_type: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SupportConversationBase(BaseModel):
    status: str


class SupportConversationCreate(SupportConversationBase):
    customer_id: Optional[int] = None
    guest_id: Optional[str] = None


class SupportUserResponse(BaseModel):
    id: int
    public_id: str
    full_name: str
    avatar_url: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class SupportConversationListResponse(SupportConversationBase):
    id: str
    customer_id: Optional[int]
    guest_id: Optional[str]
    supporter_id: Optional[int]
    created_at: datetime
    updated_at: Optional[datetime]
    customer: Optional[SupportUserResponse] = None
    supporter: Optional[SupportUserResponse] = None
    last_message: Optional[str] = None
    has_unread: Optional[bool] = False

    model_config = ConfigDict(from_attributes=True)


class SupportConversationResponse(SupportConversationListResponse):
    messages: List[SupportMessageResponse] = []

    model_config = ConfigDict(from_attributes=True)
