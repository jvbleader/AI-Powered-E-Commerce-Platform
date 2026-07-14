from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class UserAddressBase(BaseModel):
    receiver_name: str = Field(min_length=2, max_length=150)
    phone: str = Field(min_length=9, max_length=20)
    province: str = Field(min_length=1, max_length=100)
    district: str = Field(min_length=1, max_length=100)
    ward: str = Field(min_length=1, max_length=100)
    detail_address: str = Field(min_length=5, max_length=255)
    address_type: str = Field(default="HOME")
    is_default: bool = Field(default=False)


class UserAddressCreate(UserAddressBase):
    pass


class UserAddressUpdate(BaseModel):
    receiver_name: Optional[str] = Field(None, min_length=2, max_length=150)
    phone: Optional[str] = Field(None, min_length=9, max_length=20)
    province: Optional[str] = Field(None, min_length=1, max_length=100)
    district: Optional[str] = Field(None, min_length=1, max_length=100)
    ward: Optional[str] = Field(None, min_length=1, max_length=100)
    detail_address: Optional[str] = Field(None, min_length=5, max_length=255)
    address_type: Optional[str] = None
    is_default: Optional[bool] = None


class UserAddressResponse(UserAddressBase):
    id: int
    user_id: int
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True
