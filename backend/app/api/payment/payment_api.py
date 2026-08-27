import logging
from typing import Annotated, Optional

from fastapi import APIRouter, Query, Request, status
from fastapi.responses import RedirectResponse

from core.config import settings
from core.database import DBSession
from dependencies.auth import CurrentAdmin, CurrentUser
from schemas.payment.payment_schema import (
    PaymentCreateRequest,
    PaymentResponse,
    VNPayIpnResponse,
    VNPayPaymentCreateRequest,
    VNPayPaymentCreateResponse,
    VNPayQueryRequest,
    VNPayRefundRequest,
    VNPayRefundResponse,
    VNPayReturnResponse,
)
import services.payment.payment_service as payment_service
import services.payment.vnpay_payment_service as vnpay_payment_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/payments", tags=["Payment"])


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "127.0.0.1"


@router.get("/{payment_code}", response_model=PaymentResponse)
async def get_payment_detail(
    payment_code: str,
    user: CurrentUser,
    db: DBSession,
):
    return await payment_service.get_payment_detail(user, payment_code, db)


@router.post(
    "/create", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED
)
async def create_payment(
    user: CurrentUser,
    data: PaymentCreateRequest,
    db: DBSession,
):
    try:
        payment = await payment_service.create_payment(user, data, db)
        await db.commit()
        return payment
    except Exception:
        await db.rollback()
        raise


@router.post(
    "/vnpay/create",
    response_model=VNPayPaymentCreateResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_vnpay_payment(
    request: Request,
    user: CurrentUser,
    data: VNPayPaymentCreateRequest,
    db: DBSession,
):
    try:
        payment, payment_url = await vnpay_payment_service.create_vnpay_payment(
            user,
            PaymentCreateRequest(
                order_codes=data.order_codes,
                payment_method="VNPAY",
            ),
            db=db,
            ip_addr=_client_ip(request),
            bank_code=data.bank_code,
        )
        await db.commit()
        return VNPayPaymentCreateResponse(payment=payment, payment_url=payment_url)
    except Exception:
        await db.rollback()
        raise


@router.post(
    "/vnpay/resume",
    response_model=VNPayPaymentCreateResponse,
)
async def resume_vnpay_payment(
    request: Request,
    user: CurrentUser,
    data: VNPayQueryRequest,
    db: DBSession,
):
    """Tạo lại payment URL cho giao dịch VNPay còn PENDING."""
    try:
        payment, payment_url = await vnpay_payment_service.rebuild_vnpay_payment_url(
            user,
            data.payment_code,
            db=db,
            ip_addr=_client_ip(request),
        )
        await db.commit()
        return VNPayPaymentCreateResponse(payment=payment, payment_url=payment_url)
    except Exception:
        await db.rollback()
        raise


@router.get("/vnpay/return")
async def vnpay_return(
    request: Request,
    db: DBSession,
    redirect: Annotated[Optional[bool], Query()] = None,
):
    try:
        result = await vnpay_payment_service.handle_vnpay_return(
            dict(request.query_params), db
        )
        await db.commit()

        if redirect:
            status_param = "success" if result["display_success"] else "failed"
            payment_code = result.get("payment_code") or ""
            target = (
                f"{settings.FRONTEND_URL}/payment/result"
                f"?status={status_param}&payment_code={payment_code}"
            )
            return RedirectResponse(url=target, status_code=status.HTTP_302_FOUND)

        return VNPayReturnResponse(**result)
    except Exception:
        await db.rollback()
        raise


@router.get("/vnpay/ipn", response_model=VNPayIpnResponse)
async def vnpay_ipn(request: Request, db: DBSession):
    try:
        result = await vnpay_payment_service.handle_vnpay_ipn(
            dict(request.query_params), db
        )
        await db.commit()
        logger.info(
            "VNPay IPN result txn_ref=%s RspCode=%s Message=%s",
            dict(request.query_params).get("vnp_TxnRef"),
            result.get("RspCode"),
            result.get("Message"),
        )
        return VNPayIpnResponse(**result)
    except Exception:
        await db.rollback()
        return VNPayIpnResponse(RspCode="99", Message="Unknown error")


@router.post("/vnpay/querydr")
async def vnpay_querydr(
    request: Request,
    user: CurrentAdmin,
    data: VNPayQueryRequest,
    db: DBSession,
):
    return await vnpay_payment_service.query_vnpay_transaction(
        data.payment_code,
        db=db,
        ip_addr=_client_ip(request),
    )


@router.post("/vnpay/refund", response_model=VNPayRefundResponse)
async def vnpay_refund(
    request: Request,
    user: CurrentAdmin,
    data: VNPayRefundRequest,
    db: DBSession,
):
    try:
        refund = await vnpay_payment_service.refund_vnpay_payment(
            data.payment_code,
            amount=data.amount,
            reason=data.reason,
            created_by=user.email,
            db=db,
            ip_addr=_client_ip(request),
            partial=data.partial,
            order_id=data.order_id,
        )
        await db.commit()
        return VNPayRefundResponse(
            refund_status=refund.refund_status,
            amount=refund.amount,
            gateway_response=refund.gateway_response,
        )
    except Exception:
        await db.rollback()
        raise

