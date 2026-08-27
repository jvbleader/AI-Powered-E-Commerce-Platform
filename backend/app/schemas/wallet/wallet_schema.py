from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field


# --- Bank Account Info ---
class BankAccountInfo(BaseModel):
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_account_name: Optional[str] = None

    class Config:
        from_attributes = True


class UpdateWalletBankAccountRequest(BaseModel):
    bank_name: str = Field(min_length=2, max_length=100)
    bank_account_number: str = Field(min_length=4, max_length=50)
    bank_account_name: str = Field(min_length=2, max_length=150)


# --- Wallet Info ---
class WalletResponse(BaseModel):
    balance: Decimal
    status: str
    has_pin: bool
    bank_info: Optional[BankAccountInfo] = None
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
    method: str = Field(default="VNPAY", description="VNPAY")


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


# --- Withdrawal ---
class WalletWithdrawalRequest(BaseModel):
    amount: Decimal = Field(ge=50000, le=10_000_000, description="Số tiền rút tối thiểu 50.000 VNĐ, tối đa 10.000.000 VNĐ")
    pin: Optional[str] = Field(None, min_length=6, max_length=6, pattern=r"^\d{6}$")
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_account_name: Optional[str] = None


class WalletWithdrawalResponse(BaseModel):
    transaction_code: str
    amount: Decimal
    balance_before: Decimal
    balance_after: Decimal
    bank_info: BankAccountInfo
    message: str
    created_at: datetime

    class Config:
        from_attributes = True
