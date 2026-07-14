from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime


class AddToCartRequest(BaseModel):
    variant_id: str = Field(..., description="The public_id of the product variant")
    quantity: int = Field(default=1, ge=1, description="Quantity to add")


class UpdateCartItemRequest(BaseModel):
    quantity: Optional[int] = Field(None, ge=1, description="New quantity")
    is_selected: Optional[bool] = Field(None, description="Select or deselect item")


class CartItemResponse(BaseModel):
    id: int
    variant_id: str = Field(alias="variantPublicId")
    quantity: int
    is_selected: bool = Field(alias="isSelected")
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True
        populate_by_name = True


class CartResponse(BaseModel):
    id: int
    items: List[CartItemResponse]
    created_at: datetime
    updated_at: Optional[datetime]

    class Config:
        from_attributes = True


class SyncCartRequest(BaseModel):
    items: List[AddToCartRequest]
