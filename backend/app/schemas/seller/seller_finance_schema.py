from datetime import datetime
from decimal import Decimal
from typing import List, Optional

from pydantic import BaseModel, Field


class BankAccountInfo(BaseModel):
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_account_name: Optional[str] = None


class SellerWalletResponse(BaseModel):
    id: int
    seller_id: int
    available_balance: Decimal
    pending_balance: Decimal
    total_withdrawn: Decimal
    bank_info: BankAccountInfo
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class SellerWalletTransactionResponse(BaseModel):
    id: int
    transaction_type: str
    amount: Decimal
    balance_before: Decimal
    balance_after: Decimal
    gross_amount: Optional[Decimal] = None
    payment_fee: Optional[Decimal] = None
    commission_fee: Optional[Decimal] = None
    order_id: Optional[int] = None
    order_code: Optional[str] = None
    payout_id: Optional[int] = None
    payout_code: Optional[str] = None
    description: str
    created_at: datetime

    class Config:
        from_attributes = True


class PaginatedWalletTransactionsResponse(BaseModel):
    items: List[SellerWalletTransactionResponse]
    total: int
    page: int
    limit: int


class SellerPayoutResponse(BaseModel):
    id: int
    payout_code: Optional[str] = None
    amount: Decimal
    payout_status: str
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_account_name: Optional[str] = None
    note: Optional[str] = None
    paid_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PaginatedSellerPayoutsResponse(BaseModel):
    items: List[SellerPayoutResponse]
    total: int
    page: int
    limit: int


class WithdrawalRequest(BaseModel):
    amount: Decimal = Field(..., ge=50000, description="Số tiền rút tối thiểu 50.000 VNĐ")
    bank_name: Optional[str] = None
    bank_account_number: Optional[str] = None
    bank_account_name: Optional[str] = None


class UpdateBankAccountRequest(BaseModel):
    bank_name: str = Field(..., min_length=2, max_length=150)
    bank_account_number: str = Field(..., min_length=4, max_length=50)
    bank_account_name: str = Field(..., min_length=2, max_length=150)
