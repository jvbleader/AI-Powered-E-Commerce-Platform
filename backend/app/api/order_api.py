from typing import Annotated, List

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.auth import get_current_user
from models.user import User
from schemas.auth_schema import MessageResponse
from schemas.order_schema import (
    CancelOrderRequest,
    CheckoutCartRequest,
    CheckoutDirectRequest,
    OrderListResponse,
    OrderResponse,
)
from services import order_service

router = APIRouter(prefix="/orders", tags=["Order"])


@router.post(
    "/checkout-cart",
    response_model=List[OrderResponse],
    status_code=status.HTTP_201_CREATED,
)
async def checkout_cart(
    user: Annotated[User, Depends(get_current_user)],
    data: CheckoutCartRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    try:
        orders = await order_service.checkout_from_cart(user, data, db)
        await db.commit()
        return orders
    except Exception:
        await db.rollback()
        raise


@router.post(
    "/checkout-direct",
    response_model=List[OrderResponse],
    status_code=status.HTTP_201_CREATED,
)
async def checkout_direct(
    user: Annotated[User, Depends(get_current_user)],
    data: CheckoutDirectRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    try:
        orders = await order_service.checkout_direct(user, data, db)
        await db.commit()
        return orders
    except Exception:
        await db.rollback()
        raise


@router.get("", response_model=OrderListResponse)
async def get_my_orders(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    orders = await order_service.get_user_orders(user, db)
    return OrderListResponse(items=orders, total=len(orders))


@router.get("/{order_code}", response_model=OrderResponse)
async def get_order_detail(
    order_code: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await order_service.get_order_detail(user, order_code, db)


@router.patch("/{order_code}/confirm-receipt", response_model=OrderResponse)
async def confirm_receipt(
    order_code: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    try:
        order = await order_service.confirm_receipt(user, order_code, db)
        await db.commit()
        # Refresh order logic to ensure response has updated status if needed
        await db.refresh(order, ["items", "seller"])
        return order
    except Exception:
        await db.rollback()
        raise


@router.post("/{order_code}/cancel", response_model=OrderResponse)
async def cancel_order(
    order_code: str,
    data: CancelOrderRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    try:
        order = await order_service.cancel_order(user, order_code, data.reason, db)
        await db.commit()
        await db.refresh(order, ["items", "seller"])
        return order
    except Exception:
        await db.rollback()
        raise
