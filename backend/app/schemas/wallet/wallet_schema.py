from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field


# --- Wallet Info ---
class WalletResponse(BaseModel):
    balance: Decimal
    status: str
    has_pin: bool
    created_at: datetime

    class Config:
        from_attributes = True


# --- PIN ---
class CreatePinRequest(BaseModel):
    pin: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class ChangePinRequest(BaseModel):
    old_pin: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
    new_pin: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class ForgotPinRequest(BaseModel):
    pass  # No body needed — uses authenticated user's email


class ResetPinRequest(BaseModel):
    otp: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
    new_pin: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


# --- Top-up ---
class TopupRequest(BaseModel):
    amount: Decimal = Field(gt=0, le=10_000_000)
    method: str = Field(description="VNPAY or MOCK")


class TopupResponse(BaseModel):
    transaction_code: str
    amount: Decimal
    new_balance: Decimal
    payment_url: Optional[str] = None  # Only for VNPay


# --- Wallet Payment ---
class WalletPaymentRequest(BaseModel):
    order_codes: List[str] = Field(min_length=1)
    pin: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


# --- Transaction History ---
class WalletTransactionResponse(BaseModel):
    transaction_code: str
    amount: Decimal
    balance_before: Decimal
    balance_after: Decimal
    transaction_type: str
    reference_type: Optional[str]
    reference_id: Optional[int]
    description: str
    created_at: datetime

    class Config:
        from_attributes = True


class WalletTransactionListResponse(BaseModel):
    items: List[WalletTransactionResponse]
    total: int
    limit: int
    offset: int


# --- VNPay Top-up Return ---
class TopupVNPayReturnResponse(BaseModel):
    signature_valid: bool
    transaction_code: Optional[str]
    display_success: bool
    message: str
    new_balance: Optional[Decimal] = None
