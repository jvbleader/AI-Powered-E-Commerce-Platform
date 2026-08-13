from typing import Annotated, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import DBSession
from dependencies.auth import CurrentUser
from models.user import User
from schemas.seller.seller_order_schema import OrderListResponse, OrderResponse
from schemas.order.order_schema import CancelOrderRequest
from services.seller.seller_order_service import (
    get_seller_orders,
    get_seller_order_detail,
    confirm_seller_order,
    update_order_to_shipping,
    cancel_seller_order,
)

router = APIRouter(prefix="/seller/orders", tags=["Seller Orders"])


@router.get("", response_model=OrderListResponse)
async def get_orders_api(
    user: CurrentUser,
    db: DBSession,
    status: Optional[str] = Query(None),
    customer_id: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
) -> OrderListResponse:
    skip = (page - 1) * limit
    result = None
    try:
        result = await get_seller_orders(user, db, status, customer_id, skip, limit)
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    return result


@router.get("/{order_id}", response_model=OrderResponse)
async def get_order_detail_api(
    order_id: str,
    user: CurrentUser,
    db: DBSession,
) -> OrderResponse:
    return await get_seller_order_detail(user, order_id, db)


@router.patch("/{order_id}/confirm", response_model=OrderResponse)
async def confirm_order_api(
    order_id: str,
    user: CurrentUser,
    db: DBSession,
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
    user: CurrentUser,
    db: DBSession,
) -> OrderResponse:
    result = None
    try:
        result = await update_order_to_shipping(user, order_id, db)
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    return result

from fastapi import APIRouter, Depends, Query, BackgroundTasks
from services.search.search_helpers import update_products_in_es

@router.post("/{order_id}/cancel", response_model=OrderResponse)
async def cancel_order_api(
    order_id: str,
    data: CancelOrderRequest,
    user: CurrentUser,
    db: DBSession,
    background_tasks: BackgroundTasks
) -> OrderResponse:
    result = None
    try:
        result = await cancel_seller_order(user, order_id, data.reason, db)
        await db.commit()
        
        # Trigger ES sync
        product_ids = {item.product_id for item in result.items if item.product_id}
        if product_ids:
            background_tasks.add_task(update_products_in_es, list(product_ids))
            
    except Exception:
        await db.rollback()
        raise
    return result


import services.seller.seller_order_service as seller_order_service

@router.post("/{order_id}/increment-print-count", response_model=OrderResponse)
async def increment_print_count_api(
    order_id: str,
    user: CurrentUser,
    db: DBSession,
) -> OrderResponse:
    result = None
    try:
        result = await seller_order_service.increment_print_count(user, order_id, db)
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    return result

