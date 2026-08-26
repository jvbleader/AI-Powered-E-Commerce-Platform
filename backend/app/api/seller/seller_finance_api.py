from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import DBSession
from dependencies.auth import CurrentUser
from models.user import User
import repositories.seller.seller_profile_repository as seller_repo
import repositories.seller.seller_wallet_repository as wallet_repo
from schemas.seller.seller_finance_schema import (
    BankAccountInfo,
    PaginatedSellerPayoutsResponse,
    PaginatedWalletTransactionsResponse,
    SellerPayoutResponse,
    SellerWalletResponse,
    SellerWalletTransactionResponse,
    UpdateBankAccountRequest,
    WithdrawalRequest,
)
import services.seller.seller_wallet_service as wallet_svc

router = APIRouter(prefix="/seller/finance", tags=["Seller Finance"])


async def _get_seller_profile_or_403(user: User, db: AsyncSession):
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Yêu cầu đăng nhập",
        )
    seller = await seller_repo.get_seller_profile_by_user_id(user.id, db)
    if not seller:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn chưa có hồ sơ người bán",
        )
    if seller.status != "APPROVED":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản người bán chưa được kích hoạt hoặc đã bị khóa",
        )
    return seller


@router.get("/wallet", response_model=SellerWalletResponse)
async def get_seller_wallet_api(
    user: CurrentUser,
    db: DBSession,
) -> SellerWalletResponse:
    seller = await _get_seller_profile_or_403(user, db)
    wallet = await wallet_svc.get_or_create_seller_wallet(db, seller.id)
    await db.commit()

    return SellerWalletResponse(
        id=wallet.id,
        seller_id=wallet.seller_id,
        available_balance=wallet.available_balance,
        pending_balance=wallet.pending_balance,
        total_withdrawn=wallet.total_withdrawn,
        bank_info=BankAccountInfo(
            bank_name=seller.bank_name,
            bank_account_number=seller.bank_account_number,
            bank_account_name=seller.bank_account_name,
        ),
        created_at=wallet.created_at,
        updated_at=wallet.updated_at,
    )


@router.get("/transactions", response_model=PaginatedWalletTransactionsResponse)
async def get_wallet_transactions_api(
    user: CurrentUser,
    db: DBSession,
    tx_type: Optional[str] = Query(None, description="ORDER_SETTLEMENT, WITHDRAWAL..."),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> PaginatedWalletTransactionsResponse:
    seller = await _get_seller_profile_or_403(user, db)
    offset = (page - 1) * limit

    items, total = await wallet_repo.get_wallet_transactions(
        seller_id=seller.id,
        db=db,
        tx_type=tx_type,
        start_date=start_date,
        end_date=end_date,
        limit=limit,
        offset=offset,
    )
    await db.commit()

    response_items = []
    for tx in items:
        order_code = tx.order.order_code if tx.order else None
        payout_code = tx.payout.payout_code if tx.payout else None
        response_items.append(
            SellerWalletTransactionResponse(
                id=tx.id,
                transaction_type=tx.transaction_type,
                amount=tx.amount,
                balance_before=tx.balance_before,
                balance_after=tx.balance_after,
                gross_amount=tx.gross_amount,
                payment_fee=tx.payment_fee,
                commission_fee=tx.commission_fee,
                order_id=tx.order_id,
                order_code=order_code,
                payout_id=tx.payout_id,
                payout_code=payout_code,
                description=tx.description,
                created_at=tx.created_at,
            )
        )

    return PaginatedWalletTransactionsResponse(
        items=response_items,
        total=total,
        page=page,
        limit=limit,
    )


@router.get("/payouts", response_model=PaginatedSellerPayoutsResponse)
async def get_seller_payouts_api(
    user: CurrentUser,
    db: DBSession,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
) -> PaginatedSellerPayoutsResponse:
    seller = await _get_seller_profile_or_403(user, db)
    offset = (page - 1) * limit

    items, total = await wallet_repo.get_seller_payouts(
        seller_id=seller.id,
        db=db,
        limit=limit,
        offset=offset,
    )
    await db.commit()

    return PaginatedSellerPayoutsResponse(
        items=[SellerPayoutResponse.model_validate(p) for p in items],
        total=total,
        page=page,
        limit=limit,
    )


@router.post("/withdraw", response_model=SellerPayoutResponse)
async def request_withdrawal_api(
    body: WithdrawalRequest,
    user: CurrentUser,
    db: DBSession,
) -> SellerPayoutResponse:
    seller = await _get_seller_profile_or_403(user, db)

    try:
        payout = await wallet_svc.request_withdrawal(
            db=db,
            seller=seller,
            amount=body.amount,
            bank_name=body.bank_name,
            bank_account_number=body.bank_account_number,
            bank_account_name=body.bank_account_name,
        )
        await db.commit()
    except Exception:
        await db.rollback()
        raise

    return SellerPayoutResponse.model_validate(payout)


@router.put("/bank-account", response_model=BankAccountInfo)
async def update_bank_account_api(
    body: UpdateBankAccountRequest,
    user: CurrentUser,
    db: DBSession,
) -> BankAccountInfo:
    seller = await _get_seller_profile_or_403(user, db)

    try:
        updated_seller = await wallet_svc.update_seller_bank_account(
            db=db,
            seller=seller,
            bank_name=body.bank_name,
            bank_account_number=body.bank_account_number,
            bank_account_name=body.bank_account_name,
        )
        await db.commit()
    except Exception:
        await db.rollback()
        raise

    return BankAccountInfo(
        bank_name=updated_seller.bank_name,
        bank_account_number=updated_seller.bank_account_number,
        bank_account_name=updated_seller.bank_account_name,
    )
