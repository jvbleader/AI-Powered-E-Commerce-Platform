from typing import Annotated, List

from fastapi import APIRouter, Depends, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import DBSession
from dependencies.auth import CurrentUser
from models.user import User
from schemas.auth.auth_schema import MessageResponse
from schemas.order.order_schema import (
    CancelOrderRequest,
    CheckoutCartRequest,
    CheckoutDirectRequest,
    OrderListResponse,
    OrderResponse,
)
import services.order.order_service as order_service
from services.search.search_helpers import update_products_in_es

router = APIRouter(prefix="/orders", tags=["Order"])

def _get_product_ids_from_orders(orders: List) -> List[int]:
    product_ids = set()
    for o in orders:
        for item in o.items:
            if item.product_id:
                product_ids.add(item.product_id)
    return list(product_ids)

@router.post(
    "/checkout-cart",
    response_model=List[OrderResponse],
    status_code=status.HTTP_201_CREATED,
)
async def checkout_cart(
    user: CurrentUser,
    data: CheckoutCartRequest,
    db: DBSession,
    background_tasks: BackgroundTasks
):
    try:
        orders = await order_service.checkout_from_cart(user, data, db)
        await db.commit()
        
        # Trigger ES sync
        product_ids = _get_product_ids_from_orders(orders)
        if product_ids:
            background_tasks.add_task(update_products_in_es, product_ids)
            
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
    user: CurrentUser,
    data: CheckoutDirectRequest,
    db: DBSession,
    background_tasks: BackgroundTasks
):
    try:
        orders = await order_service.checkout_direct(user, data, db)
        await db.commit()
        
        # Trigger ES sync
        product_ids = _get_product_ids_from_orders(orders)
        if product_ids:
            background_tasks.add_task(update_products_in_es, product_ids)
            
        return orders
    except Exception:
        await db.rollback()
        raise


@router.get("", response_model=OrderListResponse)
async def get_my_orders(
    user: CurrentUser,
    db: DBSession,
):
    orders = await order_service.get_user_orders(user, db)
    return OrderListResponse(items=orders, total=len(orders))


@router.get("/{order_code}", response_model=OrderResponse)
async def get_order_detail(
    order_code: str,
    user: CurrentUser,
    db: DBSession,
):
    return await order_service.get_order_detail(user, order_code, db)


@router.patch("/{order_code}/confirm-receipt", response_model=OrderResponse)
async def confirm_receipt(
    order_code: str,
    user: CurrentUser,
    db: DBSession,
    background_tasks: BackgroundTasks
):
    try:
        order = await order_service.confirm_receipt(user, order_code, db)
        await db.commit()
        await db.refresh(order, ["items", "seller"])
        
        # Trigger ES sync
        product_ids = _get_product_ids_from_orders([order])
        if product_ids:
            background_tasks.add_task(update_products_in_es, product_ids)
            
        return order
    except Exception:
        await db.rollback()
        raise


@router.post("/{order_code}/cancel", response_model=OrderResponse)
async def cancel_order(
    order_code: str,
    data: CancelOrderRequest,
    user: CurrentUser,
    db: DBSession,
    background_tasks: BackgroundTasks
):
    try:
        order = await order_service.cancel_order(user, order_code, data.reason, db)
        await db.commit()
        await db.refresh(order, ["items", "seller"])
        
        # Trigger ES sync
        product_ids = _get_product_ids_from_orders([order])
        if product_ids:
            background_tasks.add_task(update_products_in_es, product_ids)
            
        return order
    except Exception:
        await db.rollback()
        raise

