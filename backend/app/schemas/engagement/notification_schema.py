from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    type: str
    title: str
    content: str
    is_read: bool
    action_url: Optional[str] = None
    created_at: Optional[datetime] = None
