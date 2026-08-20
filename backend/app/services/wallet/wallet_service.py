import json
import logging
import re
import secrets
from datetime import timedelta
from decimal import Decimal

from fastapi import HTTPException, status
import redis.asyncio as aioredis
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from models.base import utc_now
from models.wallet import Wallet, WalletTransaction
import repositories.wallet.wallet_repository as wallet_repository
from utils.hash_and_verify import hash_password, verify_password

logger = logging.getLogger(__name__)

TOPUP_MIN_AMOUNT = Decimal("10000")
TOPUP_MAX_AMOUNT = Decimal("10000000")
PIN_MAX_FAILED_ATTEMPTS = 5
PIN_LOCK_DURATION_MINUTES = 30


def generate_wallet_txn_code() -> str:
    return f"WTX-{secrets.token_hex(6).upper()}"


def _hash_pin(pin: str) -> str:
    return hash_password(pin)


def _check_pin(pin: str, pin_hash: str) -> bool:
    return verify_password(pin, pin_hash)


async def get_wallet(user_id: int, db: AsyncSession) -> Wallet | None:
    return await wallet_repository.get_wallet_by_user_id(db, user_id)


async def get_or_create_wallet(
    user_id: int, db: AsyncSession, *, for_update: bool = False
) -> Wallet:
    wallet = await wallet_repository.get_wallet_by_user_id(
        db, user_id, for_update=for_update
    )
    if wallet:
        return wallet
    wallet = Wallet(user_id=user_id, balance=Decimal("0.00"))
    return await wallet_repository.create_wallet(db, wallet)


def verify_pin(wallet: Wallet, pin: str) -> None:
    if not wallet.pin_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chưa tạo PIN cho ví. Vui lòng tạo PIN trước.",
        )
    if wallet.pin_locked_until and wallet.pin_locked_until > utc_now():
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="PIN đã bị khóa tạm thời do nhập sai quá nhiều lần. Vui lòng thử lại sau.",
        )
    if not _check_pin(pin, wallet.pin_hash):
        wallet.pin_failed_attempts += 1
        if wallet.pin_failed_attempts >= PIN_MAX_FAILED_ATTEMPTS:
            wallet.pin_locked_until = utc_now() + timedelta(
                minutes=PIN_LOCK_DURATION_MINUTES
            )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="PIN không chính xác.",
        )
    # Reset on success
    wallet.pin_failed_attempts = 0
    wallet.pin_locked_until = None


async def create_pin(user_id: int, pin: str, db: AsyncSession) -> Wallet:
    wallet = await get_or_create_wallet(user_id, db)
    if wallet.pin_hash is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="PIN đã được tạo. Sử dụng chức năng đổi PIN.",
        )
    wallet.pin_hash = _hash_pin(pin)
    wallet.pin_set_at = utc_now()
    wallet.pin_failed_attempts = 0
    wallet.pin_locked_until = None
    return wallet


async def change_pin(
    user_id: int, old_pin: str, new_pin: str, db: AsyncSession
) -> Wallet:
    wallet = await wallet_repository.get_wallet_by_user_id(db, user_id)
    if not wallet or not wallet.pin_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chưa tạo PIN cho ví.",
        )
    verify_pin(wallet, old_pin)
    wallet.pin_hash = _hash_pin(new_pin)
    wallet.pin_set_at = utc_now()
    wallet.pin_failed_attempts = 0
    wallet.pin_locked_until = None
    return wallet


def _sanitize_order_info(text: str) -> str:
    ascii_text = text.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-zA-Z0-9\s.,:-]", "", ascii_text)[:255]


def _validate_topup_amount(amount: Decimal) -> None:
    if amount < TOPUP_MIN_AMOUNT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Số tiền nạp tối thiểu là {TOPUP_MIN_AMOUNT:,.0f} VND",
        )
    if amount > TOPUP_MAX_AMOUNT:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Số tiền nạp tối đa mỗi lần là {TOPUP_MAX_AMOUNT:,.0f} VND",
        )


async def topup_mock(
    user_id: int, amount: Decimal, db: AsyncSession
) -> tuple[WalletTransaction, Wallet]:
    _validate_topup_amount(amount)
    wallet = await get_or_create_wallet(user_id, db, for_update=True)

    balance_before = wallet.balance
    wallet.balance += amount
    balance_after = wallet.balance

    txn = WalletTransaction(
        wallet_id=wallet.id,
        transaction_code=generate_wallet_txn_code(),
        amount=amount,
        balance_before=balance_before,
        balance_after=balance_after,
        transaction_type="TOPUP",
        reference_type="MOCK",
        description=f"Nạp tiền vào ví (Mock): +{amount:,.0f} VND",
    )
    await wallet_repository.add_wallet_transaction(db, txn)
    return txn, wallet


async def topup_vnpay(
    user_id: int,
    amount: Decimal,
    db: AsyncSession,
    ip_addr: str,
) -> tuple[str, str]:
    from services.payment.vnpay import VNPayClient, VNPayError

    _validate_topup_amount(amount)
    wallet = await get_or_create_wallet(user_id, db)

    txn_code = generate_wallet_txn_code()

    # Store pending top-up as a WalletTransaction with balance_before/after = 0
    # (will be updated on IPN success)
    pending_txn = WalletTransaction(
        wallet_id=wallet.id,
        transaction_code=txn_code,
        amount=amount,
        balance_before=Decimal("0"),
        balance_after=Decimal("0"),
        transaction_type="TOPUP",
        reference_type="VNPAY_PENDING",
        description=f"Nạp tiền vào ví qua VNPay: {amount:,.0f} VND (đang chờ)",
    )
    await wallet_repository.add_wallet_transaction(db, pending_txn)

    try:
        client = VNPayClient()
        if hasattr(settings, "VNPAY_WALLET_RETURN_URL") and settings.VNPAY_WALLET_RETURN_URL:
            client.return_url = settings.VNPAY_WALLET_RETURN_URL
        order_info = _sanitize_order_info(f"Nap tien vi {txn_code}")
        payment_url, _meta = client.build_payment_url(
            txn_ref=txn_code,
            amount=amount,
            order_info=order_info,
            ip_addr=ip_addr,
        )
    except VNPayError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY, detail=exc.message
        ) from exc

    return payment_url, txn_code


async def handle_topup_vnpay_ipn(
    raw_params: dict[str, str], db: AsyncSession
) -> dict[str, str]:
    from sqlalchemy import select
    from core.config import settings
    from services.payment.vnpay import verify_pay_signature
    from services.payment.vnpay.errors import (
        IPN_CONFIRM_SUCCESS,
        IPN_INVALID_SIGNATURE,
        IPN_ORDER_NOT_FOUND,
        IPN_UNKNOWN_ERROR,
        PAYMENT_SUCCESS,
        TXN_STATUS_SUCCESS,
    )

    params = {k: v for k, v in raw_params.items() if k.startswith("vnp_") and v}

    try:
        if not verify_pay_signature(
            params, settings.VNPAY_HASH_SECRET or "", settings.VNPAY_HASH_ALGORITHM
        ):
            return {"RspCode": IPN_INVALID_SIGNATURE, "Message": "Invalid Checksum"}

        txn_ref = params.get("vnp_TxnRef", "")
        if not txn_ref or not txn_ref.startswith("WTX-"):
            return {"RspCode": IPN_ORDER_NOT_FOUND, "Message": "Order not Found"}

        # Find pending transaction with lock
        stmt = (
            select(WalletTransaction)
            .where(WalletTransaction.transaction_code == txn_ref)
            .with_for_update()
        )
        result = await db.execute(stmt)
        pending_txn = result.scalar_one_or_none()

        if not pending_txn:
            return {"RspCode": IPN_ORDER_NOT_FOUND, "Message": "Order not Found"}

        if pending_txn.reference_type != "VNPAY_PENDING":
            return {"RspCode": "02", "Message": "Already confirmed"}

        is_success = (
            params.get("vnp_ResponseCode") == PAYMENT_SUCCESS
            and params.get("vnp_TransactionStatus") == TXN_STATUS_SUCCESS
        )

        if is_success:
            # Lock wallet and credit
            wallet_stmt = (
                select(Wallet)
                .where(Wallet.id == pending_txn.wallet_id)
                .with_for_update()
            )
            wallet_result = await db.execute(wallet_stmt)
            wallet = wallet_result.scalar_one()

            pending_txn.balance_before = wallet.balance
            wallet.balance += pending_txn.amount
            pending_txn.balance_after = wallet.balance
            pending_txn.reference_type = "VNPAY_SUCCESS"
            pending_txn.description = (
                f"Nạp tiền vào ví qua VNPay: +{pending_txn.amount:,.0f} VND"
            )
        else:
            pending_txn.reference_type = "VNPAY_FAILED"
            pending_txn.description = (
                f"Nạp tiền vào ví qua VNPay thất bại: {pending_txn.amount:,.0f} VND"
            )

        return {"RspCode": IPN_CONFIRM_SUCCESS, "Message": "Confirm Success"}

    except Exception:
        logger.exception("Wallet topup VNPay IPN error")
        return {"RspCode": IPN_UNKNOWN_ERROR, "Message": "Unknown error"}


async def handle_topup_vnpay_return(
    raw_params: dict[str, str], db: AsyncSession
) -> dict:
    from sqlalchemy import select
    from core.config import settings
    from services.payment.vnpay import verify_pay_signature
    from services.payment.vnpay.errors import PAYMENT_SUCCESS, TXN_STATUS_SUCCESS

    params = {k: v for k, v in raw_params.items() if k.startswith("vnp_") and v}
    valid = verify_pay_signature(
        params, settings.VNPAY_HASH_SECRET or "", settings.VNPAY_HASH_ALGORITHM
    )
    display_success = (
        valid
        and params.get("vnp_ResponseCode") == PAYMENT_SUCCESS
        and params.get("vnp_TransactionStatus") == TXN_STATUS_SUCCESS
    )

    txn_ref = params.get("vnp_TxnRef", "")
    new_balance = None
    if txn_ref:
        stmt = (
            select(WalletTransaction)
            .where(WalletTransaction.transaction_code == txn_ref)
            .with_for_update()
        )
        result = await db.execute(stmt)
        txn = result.scalar_one_or_none()
        if txn:
            if display_success and txn.reference_type == "VNPAY_PENDING":
                wallet_stmt = (
                    select(Wallet)
                    .where(Wallet.id == txn.wallet_id)
                    .with_for_update()
                )
                wallet_result = await db.execute(wallet_stmt)
                wallet = wallet_result.scalar_one()

                txn.balance_before = wallet.balance
                wallet.balance += txn.amount
                txn.balance_after = wallet.balance
                txn.reference_type = "VNPAY_SUCCESS"
                txn.description = (
                    f"Nạp tiền vào ví qua VNPay: +{txn.amount:,.0f} VND"
                )
                new_balance = wallet.balance
            elif not display_success and txn.reference_type == "VNPAY_PENDING":
                txn.reference_type = "VNPAY_FAILED"
                txn.description = (
                    f"Nạp tiền vào ví qua VNPay thất bại: {txn.amount:,.0f} VND"
                )
            elif txn.reference_type == "VNPAY_SUCCESS":
                new_balance = txn.balance_after

    return {
        "signature_valid": valid,
        "transaction_code": txn_ref,
        "display_success": display_success,
        "message": "Nạp tiền thành công" if display_success else "Nạp tiền không thành công",
        "new_balance": new_balance,
    }


async def pay_with_wallet(
    user, order_codes: list[str], pin: str, db: AsyncSession
):
    import repositories.order.order_repository as order_repository
    import repositories.payment.payment_repository as payment_repository
    from models.payment import Payment, PaymentOrder
    from models.order import OrderStatusLog
    from services.payment.payment_service import generate_payment_code

    # 1. Validate wallet + PIN with row lock
    wallet = await wallet_repository.get_wallet_by_user_id(
        db, user.id, for_update=True
    )
    if not wallet:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Bạn chưa có ví. Vui lòng tạo ví trước.",
        )
    if wallet.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Ví đang bị khóa."
        )
    verify_pin(wallet, pin)

    # 2. Validate orders
    if not order_codes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Danh sách đơn hàng không được để trống",
        )
    orders = await order_repository.get_orders_by_codes_and_user(
        db, order_codes, user.id
    )
    if len(orders) != len(set(order_codes)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Một hoặc nhiều đơn hàng không tồn tại hoặc không thuộc về bạn",
        )

    total_amount = Decimal("0.00")
    existing_payment_ids = set()
    for order in orders:
        if order.payment_status != "PENDING":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Đơn hàng {order.order_code} không ở trạng thái chờ thanh toán",
            )
        if order.payment_order is not None:
            existing_payment_ids.add(order.payment_order.payment_id)
        total_amount += order.total_amount

    # 3. Check balance
    if wallet.balance < total_amount:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Số dư ví không đủ. Cần {total_amount:,.0f} VND, hiện có {wallet.balance:,.0f} VND",
        )

    # 4. Deduct wallet
    balance_before = wallet.balance
    wallet.balance -= total_amount
    balance_after = wallet.balance

    txn = WalletTransaction(
        wallet_id=wallet.id,
        transaction_code=generate_wallet_txn_code(),
        amount=-total_amount,
        balance_before=balance_before,
        balance_after=balance_after,
        transaction_type="ORDER_PAYMENT",
        reference_type="PAYMENT",
        description=f"Thanh toán đơn hàng: -{total_amount:,.0f} VND",
    )
    await wallet_repository.add_wallet_transaction(db, txn)

    # 5. Create or Update Payment (marked PAID)
    payment = None
    if len(existing_payment_ids) == 1:
        existing_pid = next(iter(existing_payment_ids))
        from sqlalchemy import select
        res = await db.execute(
            select(Payment).where(Payment.id == existing_pid).with_for_update()
        )
        p = res.scalar_one_or_none()
        if p and p.payment_status == "PENDING":
            p.payment_method = "WALLET"
            p.payment_status = "PAID"
            p.paid_at = utc_now()
            p.gateway_response = {"provider": "INTERNAL_WALLET"}
            payment = p

    if payment is None:
        if existing_payment_ids:
            from sqlalchemy import delete
            await db.execute(
                delete(PaymentOrder).where(
                    PaymentOrder.order_id.in_([o.id for o in orders])
                )
            )
        payment = Payment(
            payment_code=generate_payment_code(),
            user_id=user.id,
            payment_method="WALLET",
            payment_status="PAID",
            amount=total_amount,
            paid_at=utc_now(),
            expires_at=utc_now(),
            gateway_response={"provider": "INTERNAL_WALLET"},
        )
        await payment_repository.create_payment(db, payment)

        for order in orders:
            po = PaymentOrder(
                payment_id=payment.id,
                order_id=order.id,
                amount=order.total_amount,
            )
            await payment_repository.create_payment_order(db, po)

    # Update reference_id on transaction now that payment has an ID
    txn.reference_id = payment.id

    # 6. Update order statuses
    for order in orders:
        order.payment_status = "PAID"
        if order.seller_confirmed and order.order_status == "PLACED":
            old_status = order.order_status
            order.order_status = "READY_TO_SHIP"
            db.add(
                OrderStatusLog(
                    order_id=order.id,
                    old_status=old_status,
                    new_status="READY_TO_SHIP",
                    note="Payment completed via Wallet",
                )
            )

    # Re-fetch with order links loaded
    payment = await payment_repository.get_payment_by_code_with_orders(
        db, payment.payment_code
    )
    return payment


async def credit_wallet_for_refund(
    user_id: int,
    amount: Decimal,
    order,
    db: AsyncSession,
) -> WalletTransaction:
    from models.payment import Refund
    from services.engagement.notification_service import send_notification

    wallet = await get_or_create_wallet(user_id, db, for_update=True)

    balance_before = wallet.balance
    wallet.balance += amount
    balance_after = wallet.balance

    txn = WalletTransaction(
        wallet_id=wallet.id,
        transaction_code=generate_wallet_txn_code(),
        amount=amount,
        balance_before=balance_before,
        balance_after=balance_after,
        transaction_type="REFUND_ORDER",
        reference_type="ORDER",
        reference_id=order.id,
        description=f"Hoàn tiền đơn hàng {order.order_code}: +{amount:,.0f} VND",
    )
    await wallet_repository.add_wallet_transaction(db, txn)

    # Find associated payment for this order if available
    payment_id = None
    try:
        if hasattr(order, "payment_order") and order.payment_order:
            payment_id = order.payment_order.payment_id
    except Exception:
        payment_id = None

    if payment_id is None and getattr(order, "id", None):
        from models.payment import PaymentOrder
        from sqlalchemy import select
        res = await db.execute(select(PaymentOrder).where(PaymentOrder.order_id == order.id))
        po = res.scalar_one_or_none()
        if po:
            payment_id = po.payment_id

    if payment_id is not None:
        refund = Refund(
            payment_id=payment_id,
            order_id=order.id,
            amount=amount,
            reason=f"Hoàn tiền tự động vào ví khi hủy/trả đơn {order.order_code}",
            refund_status="SUCCESS",
            gateway_response={"provider": "INTERNAL_WALLET", "wallet_txn": txn.transaction_code},
            refunded_at=utc_now(),
        )
        db.add(refund)

    # Send notification to user
    await send_notification(
        db=db,
        user_id=user_id,
        type="wallet",
        title="Hoàn tiền vào ví",
        content=f"Đã hoàn +{amount:,.0f} VND vào ví từ đơn hàng {order.order_code}.",
        action_url="/account/wallet",
    )

    return txn


async def send_pin_reset_otp(user, db: AsyncSession) -> None:
    """Generate OTP and send to user's email for PIN reset."""
    wallet = await wallet_repository.get_wallet_by_user_id(db, user.id)
    if not wallet or not wallet.pin_hash:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ví chưa có PIN để khôi phục.",
        )

    otp = "".join(secrets.choice("0123456789") for _ in range(6))
    otp_hash = _hash_pin(otp)

    # Store OTP in Redis with 5 min TTL
    r = aioredis.from_url(settings.REDIS_URL)
    try:
        otp_key = f"wallet_pin_reset:{user.id}"
        await r.setex(otp_key, 300, json.dumps({"otp_hash": otp_hash}))
    finally:
        await r.aclose()

    # Send email
    try:
        from services.auth.verify_email_service import _send_smtp_sync
        import asyncio
        from email.message import EmailMessage

        msg = EmailMessage()
        msg["Subject"] = "Khôi phục PIN ví - Shepoo"
        msg["From"] = getattr(settings, "SMTP_USERNAME", "noreply@shepoo.com") or "noreply@shepoo.com"
        msg["To"] = user.email
        msg.set_content(
            f"Mã OTP khôi phục PIN ví của bạn là: {otp}\n"
            f"Mã có hiệu lực trong 5 phút.\n"
            f"Nếu bạn không yêu cầu, vui lòng bỏ qua email này."
        )
        await asyncio.to_thread(_send_smtp_sync, msg)
    except Exception as e:
        logger.warning("Could not send PIN reset email via SMTP (log OTP for dev): OTP is %s, error: %s", otp, e)

    logger.info("Sent wallet PIN reset OTP to user %s", user.id)


async def reset_pin_with_otp(
    user, otp: str, new_pin: str, db: AsyncSession
) -> Wallet:
    """Verify OTP and reset wallet PIN."""
    r = aioredis.from_url(settings.REDIS_URL)
    try:
        otp_key = f"wallet_pin_reset:{user.id}"
        stored = await r.get(otp_key)
        if not stored:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mã OTP không tồn tại hoặc đã hết hạn.",
            )
        data = json.loads(stored)
        if not _check_pin(otp, data["otp_hash"]):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Mã OTP không chính xác.",
            )
        # OTP valid — delete it
        await r.delete(otp_key)
    finally:
        await r.aclose()

    wallet = await wallet_repository.get_wallet_by_user_id(db, user.id)
    if not wallet:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ví không tồn tại.",
        )

    wallet.pin_hash = _hash_pin(new_pin)
    wallet.pin_set_at = utc_now()
    wallet.pin_failed_attempts = 0
    wallet.pin_locked_until = None
    return wallet


async def expire_stale_pending_topups(db: AsyncSession) -> int:
    """Auto-expire VNPAY_PENDING transactions older than 15 minutes."""
    from datetime import datetime, timedelta, timezone
    from sqlalchemy import update

    cutoff = datetime.now(timezone.utc) - timedelta(minutes=15)
    stmt = (
        update(WalletTransaction)
        .where(
            WalletTransaction.reference_type == "VNPAY_PENDING",
            WalletTransaction.created_at < cutoff,
        )
        .values(
            reference_type="VNPAY_FAILED",
            description="Giao dịch nạp tiền đã hết hạn phiên thanh toán VNPay (15 phút)",
        )
    )
    result = await db.execute(stmt)
    return result.rowcount or 0



