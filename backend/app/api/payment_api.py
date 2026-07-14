from typing import Annotated

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.auth import get_current_user
from models.user import User
from schemas.payment_schema import (
    MockPaymentCallbackRequest,
    PaymentCreateRequest,
    PaymentResponse,
)
from services import payment_service

router = APIRouter(prefix="/api/v1/payments", tags=["Payment"])


@router.post(
    "/create", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED
)
async def create_payment(
    user: Annotated[User, Depends(get_current_user)],
    data: PaymentCreateRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    try:
        payment = await payment_service.create_payment(user, data, db)
        await db.commit()
        return payment
    except Exception:
        await db.rollback()
        raise


@router.post("/mock-callback", response_model=PaymentResponse)
async def mock_callback(
    data: MockPaymentCallbackRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    try:
        # Trong thực tế, endpoint callback thường được xác thực bằng chữ ký (signature)
        # từ cổng thanh toán thay vì auth token của user.
        payment = await payment_service.process_mock_callback(data, db)
        await db.commit()
        return payment
    except Exception:
        await db.rollback()
        raise
