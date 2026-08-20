import logging
from decimal import Decimal
from typing import Annotated, Optional

from fastapi import APIRouter, HTTPException, Query, Request, status
from fastapi.responses import RedirectResponse

from core.config import settings
from core.database import DBSession
from dependencies.auth import CurrentUser
from schemas.payment.payment_schema import PaymentResponse, VNPayIpnResponse
from schemas.wallet.wallet_schema import (
    ChangePinRequest,
    CreatePinRequest,
    ResetPinRequest,
    TopupRequest,
    TopupResponse,
    TopupVNPayReturnResponse,
    WalletPaymentRequest,
    WalletResponse,
    WalletTransactionListResponse,
    WalletTransactionResponse,
)
import repositories.wallet.wallet_repository as wallet_repository
import services.wallet.wallet_service as wallet_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/wallet", tags=["Wallet"])


@router.get("", response_model=WalletResponse)
async def get_wallet(user: CurrentUser, db: DBSession):
    wallet = await wallet_service.get_wallet(user.id, db)
    if not wallet:
        return WalletResponse(
            balance=Decimal("0.00"),
            status="ACTIVE",
            has_pin=False,
            created_at=user.created_at,
        )
    return WalletResponse(
        balance=wallet.balance,
        status=wallet.status,
        has_pin=wallet.pin_hash is not None,
        created_at=wallet.created_at,
    )


@router.post("/create-pin", response_model=WalletResponse)
async def create_pin(user: CurrentUser, data: CreatePinRequest, db: DBSession):
    try:
        wallet = await wallet_service.create_pin(user.id, data.pin, db)
        await db.commit()
        return WalletResponse(
            balance=wallet.balance,
            status=wallet.status,
            has_pin=True,
            created_at=wallet.created_at,
        )
    except Exception:
        await db.rollback()
        raise


@router.put("/change-pin", response_model=WalletResponse)
async def change_pin(user: CurrentUser, data: ChangePinRequest, db: DBSession):
    try:
        wallet = await wallet_service.change_pin(
            user.id, data.old_pin, data.new_pin, db
        )
        await db.commit()
        return WalletResponse(
            balance=wallet.balance,
            status=wallet.status,
            has_pin=True,
            created_at=wallet.created_at,
        )
    except Exception:
        await db.rollback()
        raise


@router.post("/forgot-pin", status_code=status.HTTP_200_OK)
async def forgot_pin(user: CurrentUser, db: DBSession):
    try:
        await wallet_service.send_pin_reset_otp(user, db)
        return {"message": "Mã OTP đã được gửi đến email của bạn."}
    except Exception:
        await db.rollback()
        raise


@router.post("/reset-pin", response_model=WalletResponse)
async def reset_pin(user: CurrentUser, data: ResetPinRequest, db: DBSession):
    try:
        wallet = await wallet_service.reset_pin_with_otp(
            user, data.otp, data.new_pin, db
        )
        await db.commit()
        return WalletResponse(
            balance=wallet.balance,
            status=wallet.status,
            has_pin=True,
            created_at=wallet.created_at,
        )
    except Exception:
        await db.rollback()
        raise


@router.post(
    "/topup",
    response_model=TopupResponse,
    status_code=status.HTTP_201_CREATED,
)
async def topup(
    request: Request, user: CurrentUser, data: TopupRequest, db: DBSession
):
    try:
        if data.method == "MOCK":
            txn, wallet = await wallet_service.topup_mock(user.id, data.amount, db)
            await db.commit()
            return TopupResponse(
                transaction_code=txn.transaction_code,
                amount=txn.amount,
                new_balance=wallet.balance,
            )
        elif data.method == "VNPAY":
            ip_addr = request.headers.get("x-forwarded-for", "127.0.0.1").split(",")[0].strip()
            payment_url, txn_code = await wallet_service.topup_vnpay(
                user.id, data.amount, db, ip_addr
            )
            await db.commit()
            return TopupResponse(
                transaction_code=txn_code,
                amount=data.amount,
                new_balance=Decimal("0.00"),
                payment_url=payment_url,
            )
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Phương thức nạp không hợp lệ. Chọn VNPAY hoặc MOCK.",
            )
    except Exception:
        await db.rollback()
        raise


@router.get("/topup/vnpay/ipn", response_model=VNPayIpnResponse)
async def topup_vnpay_ipn(request: Request, db: DBSession):
    try:
        result = await wallet_service.handle_topup_vnpay_ipn(
            dict(request.query_params), db
        )
        await db.commit()
        return VNPayIpnResponse(**result)
    except Exception:
        await db.rollback()
        return VNPayIpnResponse(RspCode="99", Message="Unknown error")


@router.get("/topup/vnpay/return")
async def topup_vnpay_return(
    request: Request,
    db: DBSession,
    redirect: Annotated[Optional[bool], Query()] = None,
):
    try:
        result = await wallet_service.handle_topup_vnpay_return(
            dict(request.query_params), db
        )
        await db.commit()

        if redirect:
            status_param = "success" if result["display_success"] else "failed"
            txn_code = result.get("transaction_code") or ""
            target = (
                f"{settings.FRONTEND_URL}/account/wallet"
                f"?topup_status={status_param}&txn_code={txn_code}"
            )
            return RedirectResponse(url=target, status_code=status.HTTP_302_FOUND)

        return TopupVNPayReturnResponse(**result)
    except Exception:
        await db.rollback()
        raise


@router.post("/pay", response_model=PaymentResponse)
async def pay_with_wallet(
    user: CurrentUser, data: WalletPaymentRequest, db: DBSession
):
    try:
        payment = await wallet_service.pay_with_wallet(
            user, data.order_codes, data.pin, db
        )
        await db.commit()
        return payment
    except Exception:
        await db.rollback()
        raise


@router.get("/transactions", response_model=WalletTransactionListResponse)
async def get_transactions(
    user: CurrentUser,
    db: DBSession,
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    transaction_type: Optional[str] = Query(default=None),
):
    # Auto-expire any stale pending topups older than 15 minutes
    await wallet_service.expire_stale_pending_topups(db)
    await db.commit()

    wallet = await wallet_service.get_wallet(user.id, db)
    if not wallet:
        return WalletTransactionListResponse(
            items=[], total=0, limit=limit, offset=offset
        )

    items = await wallet_repository.get_wallet_transactions(
        db, wallet.id, limit=limit, offset=offset, transaction_type=transaction_type
    )
    total = await wallet_repository.count_wallet_transactions(
        db, wallet.id, transaction_type=transaction_type
    )

    return WalletTransactionListResponse(
        items=[WalletTransactionResponse.model_validate(t) for t in items],
        total=total,
        limit=limit,
        offset=offset,
    )
