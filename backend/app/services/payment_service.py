import secrets
from datetime import timedelta
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from models.base import utc_now
from models.payment import Payment
from models.payment_order import PaymentOrder
from models.user import User
from schemas.payment_schema import MockPaymentCallbackRequest, PaymentCreateRequest
from repositories import order_repository, payment_repository


def generate_payment_code() -> str:
    return f"PAY-{secrets.token_hex(4).upper()}"


async def create_payment(user: User, data: PaymentCreateRequest, db: AsyncSession):
    if not data.order_codes:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Danh sách đơn hàng không được để trống",
        )

    orders = await order_repository.get_orders_by_codes_and_user(
        db, data.order_codes, user.id
    )

    if len(orders) != len(set(data.order_codes)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Một hoặc nhiều đơn hàng không tồn tại hoặc không thuộc về bạn",
        )

    total_amount = Decimal("0.00")
    for order in orders:
        if order.payment_status != "PENDING":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Đơn hàng {order.order_code} không ở trạng thái chờ thanh toán",
            )
        total_amount += order.total_amount

    payment = Payment(
        payment_code=generate_payment_code(),
        user_id=user.id,
        payment_method=data.payment_method,
        payment_status="PENDING",
        amount=total_amount,
        expires_at=utc_now() + timedelta(days=1),
    )
    await payment_repository.create_payment(db, payment)

    for order in orders:
        payment_order = PaymentOrder(
            payment_id=payment.id, order_id=order.id, amount=order.total_amount
        )
        await payment_repository.create_payment_order(db, payment_order)

    payment = await payment_repository.get_payment_by_code_with_orders(
        db, payment.payment_code
    )
    return payment


async def process_mock_callback(data: MockPaymentCallbackRequest, db: AsyncSession):
    payment = await payment_repository.get_payment_by_code_with_orders(
        db, data.payment_code
    )

    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy giao dịch thanh toán",
        )

    if payment.payment_status != "PENDING":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Giao dịch đã được xử lý (Trạng thái: {payment.payment_status})",
        )

    if data.status == "PAID":
        payment.payment_status = "PAID"
        payment.paid_at = utc_now()
        payment.transaction_code = (
            data.transaction_code or f"TXN-{secrets.token_hex(6).upper()}"
        )
        payment.gateway_response = {"mock": True, "status": "success"}

        # Cập nhật trạng thái các đơn hàng liên quan
        for po in payment.order_links:
            order = po.order
            if order.payment_status == "PENDING":
                order.payment_status = "PAID"

    elif data.status in ["FAILED", "CANCELLED"]:
        payment.payment_status = data.status
        payment.failed_at = utc_now() if data.status == "FAILED" else None
        payment.cancelled_at = utc_now() if data.status == "CANCELLED" else None
        payment.gateway_response = {"mock": True, "status": data.status.lower()}
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Trạng thái callback không hợp lệ",
        )

    return payment
