import re

from datetime import datetime
from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
)

from schemas.user_schema import UserMeResponse

PHONE_RE = re.compile(r"^0(3|5|7|8|9)\d{8}$")
OTP_RE = re.compile(r"^\d{6}$")


def normalize_phone_number(value: str) -> str:
    phone = re.sub(r"[\s.\-()]", "", value.strip())
    if phone.startswith("+84"):
        phone = f"0{phone[3:]}"
    elif phone.startswith("84") and len(phone) == 11:
        phone = f"0{phone[2:]}"
    return phone


def validate_phone_number(value: str) -> str:
    phone = normalize_phone_number(value)
    if not PHONE_RE.fullmatch(phone):
        raise ValueError("So dien thoai khong hop le.")
    return phone


class SellerMeResponse(BaseModel):
    has_seller_profile: bool
    status: str | None = None
    can_access_seller_dashboard: bool


class SellerDashboardSummaryResponse(BaseModel):
    total_revenue: float
    total_sold: int
    pending_orders: int
    total_products: int
    updated_at: datetime | None = None



class SellerApplicationRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    shop_name: str = Field(min_length=4, max_length=100)
    phone: str = Field(min_length=8, max_length=12)
    email: EmailStr = Field()
    pickup_address: str = Field(min_length=10, max_length=200)
    tax_code: str = Field(min_length=10, max_length=14)
    bank_name: str = Field(min_length=2, max_length=150)
    bank_account_number: str = Field(min_length=3, max_length=30)
    bank_account_name: str = Field(min_length=8, max_length=100)
    shipping_fee: float = Field(default=0.0, ge=0.0)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        return value.strip().lower()

    @field_validator("phone")
    @classmethod
    def normalize_phone(cls, value: str) -> str:
        return validate_phone_number(value)


class SellerApplicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    shop_name: str
    phone: str
    email: EmailStr
    pickup_address: str
    tax_code: str
    bank_name: str
    bank_account_number: str
    bank_account_name: str
    shipping_fee: float
    status: str
    public_id: str
    shop_slug: str
    rejected_reason: str | None = None


class SellerApplicationDetailResponse(BaseModel):
    user: UserMeResponse
    seller_profile: SellerApplicationResponse


class SellerApplicationReviewResponse(SellerApplicationResponse):
    model_config = ConfigDict(from_attributes=True)

    status: str
    approved_at: datetime | None = None
    rejected_reason: str | None = None


class RejectApplicationRequest(BaseModel):
    rejected_reason: str


class ListSellerApplicationsRequest(BaseModel):
    limit: int = Field(ge=5, le=50, default=10)
    page: int = Field(ge=1, default=1)
    status: str | None = Field(default=None)
