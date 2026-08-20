import logging
import re
from datetime import timedelta
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from models.base import utc_now
from models.order import OrderStatusLog
from models.payment import Payment, Refund
from models.user import User
import repositories.payment.payment_repository as payment_repository
from schemas.payment.payment_schema import PaymentCreateRequest
from services.payment.payment_service import create_payment
from services.payment.vnpay import VNPayClient, VNPayError, verify_pay_signature
from services.payment.vnpay.errors import (
    IPN_ALREADY_CONFIRMED,
    IPN_CONFIRM_SUCCESS,
    IPN_INVALID_AMOUNT,
    IPN_INVALID_SIGNATURE,
    IPN_ORDER_NOT_FOUND,
    IPN_UNKNOWN_ERROR,
    PAYMENT_SUCCESS,
    TXN_STATUS_SUCCESS,
)

logger = logging.getLogger(__name__)

# FAQ VNPay: số tiền thanh toán tối thiểu 5,000 VND
VNPAY_MIN_AMOUNT = Decimal("5000")
# vnp_TransactionStatus=01: giao dịch chưa hoàn tất — không được đánh FAILED
TXN_STATUS_INCOMPLETE = "01"
# Các mã tình trạng coi là thất bại dứt điểm (theo bảng mã TransactionStatus)
TXN_STATUS_TERMINAL_FAILURE = frozenset({"02", "04", "05", "06", "07", "09"})


def _sanitize_order_info(text: str) -> str:
    ascii_text = text.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"[^a-zA-Z0-9\s.,:-]", "", ascii_text)[:255]


def _vnpay_amount_matches(payment: Payment, vnp_amount: str) -> bool:
    expected = int(payment.amount * 100)
    try:
        return expected == int(vnp_amount)
    except (TypeError, ValueError):
        return False


def _is_payment_success(params: dict[str, str]) -> bool:
    return (
        params.get("vnp_ResponseCode") == PAYMENT_SUCCESS
        and params.get("vnp_TransactionStatus") == TXN_STATUS_SUCCESS
    )


def _is_terminal_failure(params: dict[str, str]) -> bool:
    """True when VNPay reports a definitive non-success (not 'incomplete')."""
    txn_status = params.get("vnp_TransactionStatus", "")
    if txn_status == TXN_STATUS_INCOMPLETE:
        return False
    if txn_status in TXN_STATUS_TERMINAL_FAILURE:
        return True
    # ResponseCode khác 00 và không còn pending → thất bại (vd. hủy/timeout)
    response_code = params.get("vnp_ResponseCode", "")
    return bool(response_code) and response_code != PAYMENT_SUCCESS


async def _mark_orders_for_paid_payment(payment: Payment, db: AsyncSession) -> None:
    for po in payment.order_links:
        order = po.order
        if order.payment_status not in ("PENDING", "FAILED"):
            continue
        if order.order_status == "CANCELLED":
            order.payment_status = "REFUND_PENDING"
            db.add(
                OrderStatusLog(
                    order_id=order.id,
                    old_status=order.order_status,
                    new_status=order.order_status,
                    note="Payment received after order cancellation. Marked for refund.",
                )
            )
        else:
            order.payment_status = "PAID"
            if order.seller_confirmed and order.order_status == "PLACED":
                old_status = order.order_status
                order.order_status = "READY_TO_SHIP"
                db.add(
                    OrderStatusLog(
                        order_id=order.id,
                        old_status=old_status,
                        new_status="READY_TO_SHIP",
                        note="Payment completed via VNPay",
                    )
                )


async def apply_vnpay_payment_result(
    payment: Payment,
    params: dict[str, str],
    *,
    db: AsyncSession,
    authoritative: bool,
) -> tuple[str, str]:
    """Process VNPay callback. Returns (RspCode, Message) for IPN."""
    if not _vnpay_amount_matches(payment, params.get("vnp_Amount", "")):
        return IPN_INVALID_AMOUNT, "Invalid amount"

    if payment.payment_status == "PAID":
        return IPN_ALREADY_CONFIRMED, "Order already confirmed"

    if payment.payment_status != "PENDING":
        return IPN_ALREADY_CONFIRMED, "Order already confirmed"

    callback_payload = dict(params)
    if _is_payment_success(params):
        if authoritative:
            payment.payment_status = "PAID"
            payment.paid_at = utc_now()
            payment.transaction_code = params.get("vnp_TransactionNo")
            payment.gateway_response = _merge_gateway_response(
                payment.gateway_response, callback=callback_payload
            )
            await _mark_orders_for_paid_payment(payment, db)
    elif _is_terminal_failure(params):
        if authoritative:
            payment.payment_status = "FAILED"
            payment.failed_at = utc_now()
            payment.gateway_response = _merge_gateway_response(
                payment.gateway_response, callback=callback_payload
            )
    else:
        # Incomplete / indeterminate — giữ PENDING, vẫn ack IPN (RspCode 00)
        if authoritative:
            payment.gateway_response = _merge_gateway_response(
                payment.gateway_response, callback=callback_payload
            )

    return IPN_CONFIRM_SUCCESS, "Confirm Success"


def _merge_gateway_response(
    existing: dict | None,
    *,
    callback: dict[str, str] | None = None,
    init: dict | None = None,
    extra: dict | None = None,
) -> dict:
    """Preserve init/meta across IPN updates so QueryDR/Refund keep vnp_CreateDate."""
    merged: dict = dict(existing or {})
    merged["provider"] = "VNPAY"
    if init is not None:
        merged["init"] = init
    if callback is not None:
        merged["callback"] = callback
    if extra:
        merged.update(extra)
    return merged


async def create_vnpay_payment(
    user: User,
    data: PaymentCreateRequest,
    *,
    db: AsyncSession,
    ip_addr: str,
    bank_code: str | None = None,
) -> tuple[Payment, str]:
    vnpay_data = PaymentCreateRequest(
        order_codes=data.order_codes,
        payment_method="VNPAY",
    )
    payment = await create_payment(user, vnpay_data, db, allow_vnpay=True)
    if payment.amount < VNPAY_MIN_AMOUNT:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Số tiền thanh toán VNPay tối thiểu là {VNPAY_MIN_AMOUNT:,.0f} VND",
        )
    payment.payment_gateway = "VNPAY"

    try:
        client = VNPayClient()
        order_info = _sanitize_order_info(
            f"Thanh toan don hang {payment.payment_code}"
        )
        payment_url, meta = client.build_payment_url(
            txn_ref=payment.payment_code,
            amount=payment.amount,
            order_info=order_info,
            ip_addr=ip_addr,
            bank_code=bank_code,
        )
    except VNPayError as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE
            if exc.code == "CONFIG"
            else status.HTTP_502_BAD_GATEWAY,
            detail=exc.message,
        ) from exc

    payment.gateway_response = _merge_gateway_response(
        None,
        init=meta,
        extra={
            "payment_url": payment_url,
            "payment_url_built_at": utc_now().isoformat(),
        },
    )
    return payment, payment_url


async def rebuild_vnpay_payment_url(
    user: User,
    payment_code: str,
    *,
    db: AsyncSession,
    ip_addr: str,
    bank_code: str | None = None,
) -> tuple[Payment, str]:
    """Rebuild a fresh VNPay URL for a still-pending payment (resume after leaving gateway)."""
    payment = await payment_repository.get_payment_by_code_with_orders(db, payment_code)
    if not payment or payment.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy giao dịch")
    if payment.payment_method != "VNPAY":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Không phải giao dịch VNPay")
    if payment.payment_status not in ("PENDING", "FAILED"):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"Giao dịch không thể thanh toán lại (trạng thái: {payment.payment_status})",
        )
    if payment.expires_at and payment.expires_at < utc_now():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Giao dịch đã hết hạn thanh toán")

    for po in payment.order_links:
        if po.order.order_status == "CANCELLED":
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Đơn hàng đã bị huỷ")
            
    if payment.payment_status == "FAILED":
        payment.payment_status = "PENDING"
        payment.failed_at = None

    try:
        client = VNPayClient()
        order_info = _sanitize_order_info(
            f"Thanh toan don hang {payment.payment_code}"
        )
        payment_url, meta = client.build_payment_url(
            txn_ref=payment.payment_code,
            amount=payment.amount,
            order_info=order_info,
            ip_addr=ip_addr,
            bank_code=bank_code,
        )
    except VNPayError as exc:
        raise HTTPException(
            status.HTTP_503_SERVICE_UNAVAILABLE
            if exc.code == "CONFIG"
            else status.HTTP_502_BAD_GATEWAY,
            detail=exc.message,
        ) from exc

    payment.gateway_response = _merge_gateway_response(
        payment.gateway_response,
        init=meta,
        extra={
            "payment_url": payment_url,
            "payment_url_built_at": utc_now().isoformat(),
        },
    )
    return payment, payment_url


def _extract_vnpay_params(raw: dict[str, str]) -> dict[str, str]:
    return {
        key: value
        for key, value in raw.items()
        if key.startswith("vnp_") and value is not None
    }


async def handle_vnpay_ipn(
    raw_params: dict[str, str],
    db: AsyncSession,
) -> dict[str, str]:
    params = _extract_vnpay_params(raw_params)
    try:
        if not verify_pay_signature(
            params, settings.VNPAY_HASH_SECRET or "", settings.VNPAY_HASH_ALGORITHM
        ):
            return {"RspCode": IPN_INVALID_SIGNATURE, "Message": "Invalid Checksum"}

        if params.get("vnp_TmnCode") != settings.VNPAY_TMN_CODE:
            return {"RspCode": IPN_INVALID_SIGNATURE, "Message": "Invalid TmnCode"}

        txn_ref = params.get("vnp_TxnRef")
        if not txn_ref:
            return {"RspCode": IPN_ORDER_NOT_FOUND, "Message": "Order not Found"}

        payment = await payment_repository.get_payment_by_code_with_orders(
            db, txn_ref, for_update=True
        )
        if not payment:
            return {"RspCode": IPN_ORDER_NOT_FOUND, "Message": "Order not Found"}

        rsp_code, message = await apply_vnpay_payment_result(
            payment, params, db=db, authoritative=True
        )
        return {"RspCode": rsp_code, "Message": message}
    except Exception:
        logger.exception("VNPay IPN processing error")
        return {"RspCode": IPN_UNKNOWN_ERROR, "Message": "Unknown error"}


async def handle_vnpay_return(
    raw_params: dict[str, str],
    db: AsyncSession,
) -> dict:
    params = _extract_vnpay_params(raw_params)
    valid = verify_pay_signature(
        params, settings.VNPAY_HASH_SECRET or "", settings.VNPAY_HASH_ALGORITHM
    )
    txn_ref = params.get("vnp_TxnRef")
    payment = (
        await payment_repository.get_payment_by_code_with_orders(db, txn_ref)
        if txn_ref
        else None
    )

    display_success = _is_payment_success(params) if valid else False
    return {
        "signature_valid": valid,
        "payment_code": txn_ref,
        "payment_status": payment.payment_status if payment else None,
        "vnp_response_code": params.get("vnp_ResponseCode"),
        "vnp_transaction_status": params.get("vnp_TransactionStatus"),
        "display_success": display_success,
        "message": "Thanh toan thanh cong"
        if display_success
        else "Thanh toan khong thanh cong hoac chua xac nhan",
    }


async def query_vnpay_transaction(
    payment_code: str,
    *,
    db: AsyncSession,
    ip_addr: str,
) -> dict:
    payment = await payment_repository.get_payment_by_code_with_orders(db, payment_code)
    if not payment:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy giao dịch")

    init_meta = (payment.gateway_response or {}).get("init", {})
    transaction_date = init_meta.get("vnp_CreateDate")
    if not transaction_date:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Thiếu vnp_CreateDate — giao dịch chưa khởi tạo VNPay",
        )

    client = VNPayClient()
    try:
        return await client.query_transaction(
            txn_ref=payment.payment_code,
            transaction_date=transaction_date,
            order_info=f"Truy van giao dich {payment.payment_code}",
            ip_addr=ip_addr,
            transaction_no=payment.transaction_code,
        )
    except VNPayError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=exc.message) from exc


async def refund_vnpay_payment(
    payment_code: str,
    *,
    amount: Decimal | None,
    reason: str,
    created_by: str,
    db: AsyncSession,
    ip_addr: str,
    partial: bool = False,
    order_id: int | None = None,
) -> Refund:
    payment = await payment_repository.get_payment_by_code_with_orders(db, payment_code)
    if not payment:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy giao dịch")
    if payment.payment_status != "PAID":
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Chỉ hoàn tiền giao dịch đã thanh toán",
        )

    refund_amount = amount if amount is not None else payment.amount
    if refund_amount <= 0 or refund_amount > payment.amount:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Số tiền hoàn không hợp lệ")

    init_meta = (payment.gateway_response or {}).get("init", {})
    transaction_date = init_meta.get("vnp_CreateDate")
    if not transaction_date:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Thiếu vnp_CreateDate cho giao dịch VNPay",
        )

    transaction_type = "03" if partial else "02"
    client = VNPayClient()
    try:
        response = await client.refund_transaction(
            txn_ref=payment.payment_code,
            amount=refund_amount,
            transaction_date=transaction_date,
            order_info=reason[:255],
            ip_addr=ip_addr,
            created_by=created_by,
            transaction_no=payment.transaction_code,
            transaction_type=transaction_type,
        )
    except VNPayError as exc:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, detail=exc.message) from exc

    refund_status = (
        "SUCCESS" if response.get("vnp_ResponseCode") == PAYMENT_SUCCESS else "FAILED"
    )
    valid_order_ids = [po.order_id for po in payment.order_links]
    if not valid_order_ids:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Giao dịch không liên kết đơn hàng")

    if order_id is not None:
        if order_id not in valid_order_ids:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST, "Đơn hàng không thuộc giao dịch thanh toán này"
            )
        target_order_id = order_id
    else:
        target_order_id = valid_order_ids[0]

    refund = Refund(
        payment_id=payment.id,
        order_id=target_order_id,
        amount=refund_amount,
        reason=reason,
        refund_status=refund_status,
        gateway_response={"provider": "VNPAY", "response": response},
        refunded_at=utc_now() if refund_status == "SUCCESS" else None,
    )
    db.add(refund)

    if refund_status == "SUCCESS":
        if refund_amount == payment.amount:
            payment.payment_status = "REFUNDED"
            for po in payment.order_links:
                if po.order.payment_status in ("PAID", "REFUND_PENDING"):
                    po.order.payment_status = "REFUNDED"
        elif order_id is not None:
            for po in payment.order_links:
                if po.order_id == order_id and po.order.payment_status in ("PAID", "REFUND_PENDING"):
                    po.order.payment_status = "REFUNDED"

    return refund
