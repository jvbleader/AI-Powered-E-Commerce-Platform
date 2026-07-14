from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field


class ShippingAddressPayload(BaseModel):
    receiver_name: str
    phone: str
    province: str
    district: str
    ward: str
    detail_address: str
    address_type: str = "HOME"


class CheckoutCartRequest(BaseModel):
    cart_item_ids: List[int] = Field(
        description="Danh sách ID của các cart item (không phải variant_id)"
    )
    address_id: int = Field(description="ID của địa chỉ giao hàng")
    customer_note: Optional[str] = Field(
        default=None, description="Ghi chú của khách hàng"
    )


class CheckoutDirectItem(BaseModel):
    variant_id: int = Field(description="ID của biến thể sản phẩm")
    quantity: int = Field(gt=0, description="Số lượng mua")


class CheckoutDirectRequest(BaseModel):
    items: List[CheckoutDirectItem]
    address_id: int = Field(description="ID của địa chỉ giao hàng")
    customer_note: Optional[str] = Field(
        default=None, description="Ghi chú của khách hàng"
    )


class OrderItemResponse(BaseModel):
    id: int
    product_id: Optional[int]
    variant_id: Optional[int]
    product_name_snapshot: str
    variant_name_snapshot: str
    product_image_snapshot: Optional[str]
    seller_name_snapshot: str
    sku_snapshot: Optional[str]
    unit_price: Decimal
    quantity: int
    subtotal: Decimal

    class Config:
        from_attributes = True


class ShopInfo(BaseModel):
    public_id: str
    shop_name: str
    shop_logo_url: Optional[str]

    class Config:
        from_attributes = True


class ShipmentResponse(BaseModel):
    shipping_provider_name: Optional[str]
    receiver_name: str
    receiver_phone: str
    province: str
    district: str
    ward: str
    detail_address: str
    address_type: str
    shipped_at: Optional[datetime]
    delivered_at: Optional[datetime]

    class Config:
        from_attributes = True


class OrderResponse(BaseModel):
    public_id: str
    order_code: str
    order_status: str
    payment_status: str
    subtotal_amount: Decimal
    shipping_fee: Decimal
    product_discount_amount: Decimal
    shipping_discount_amount: Decimal
    total_amount: Decimal
    customer_note: Optional[str]
    payment_expires_at: datetime
    seller_confirm_expires_at: datetime
    completed_at: Optional[datetime]
    cancelled_at: Optional[datetime]
    created_at: datetime

    seller: Optional[ShopInfo] = None
    items: List[OrderItemResponse] = []
    shipment: Optional[ShipmentResponse] = None

    class Config:
        from_attributes = True


class OrderListResponse(BaseModel):
    items: List[OrderResponse]
    total: int


class CancelOrderRequest(BaseModel):
    reason: str = Field(min_length=5, description="Lý do hủy đơn hàng")
