from typing import Annotated, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import get_db
from dependencies.auth import get_current_user
from models.user import User
from schemas.seller_order_schema import OrderListResponse, OrderResponse
from services.seller_order_service import (
    get_seller_orders,
    confirm_seller_order,
    update_order_to_shipping,
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
