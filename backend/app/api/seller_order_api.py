from typing import Annotated, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from dependencies.auth import get_current_user
from models.user import User
from schemas.seller_order_schema import OrderListResponse, OrderResponse
from schemas.order_schema import CancelOrderRequest
from services.seller_order_service import (
    get_seller_orders,
    get_seller_order_detail,
    confirm_seller_order,
    update_order_to_shipping,
    cancel_seller_order,
)

router = APIRouter(prefix="/seller/orders", tags=["Seller Orders"])


@router.get("", response_model=OrderListResponse)
async def get_orders_api(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    status: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
) -> OrderListResponse:
    skip = (page - 1) * limit
    result = None
    try:
        result = await get_seller_orders(user, db, status, skip, limit)
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    return result


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order_detail_api(
    order_id: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> OrderResponse:
    return await get_seller_order_detail(user, order_id, db)


@router.patch("/{order_id}/confirm", response_model=OrderResponse)
async def confirm_order_api(
    order_id: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> OrderResponse:
    result = None
    try:
        result = await confirm_seller_order(user, order_id, db)
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    return result


@router.patch("/{order_id}/shipping", response_model=OrderResponse)
async def update_order_to_shipping_api(
    order_id: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> OrderResponse:
    result = None
    try:
        result = await update_order_to_shipping(user, order_id, db)
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    return result

@router.post("/{order_id}/cancel", response_model=OrderResponse)
async def cancel_order_api(
    order_id: str,
    data: CancelOrderRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> OrderResponse:
    result = None
    try:
        result = await cancel_seller_order(user, order_id, data.reason, db)
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    return result
