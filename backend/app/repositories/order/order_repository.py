from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from sqlalchemy.orm import selectinload
from models.order import Order
from models.order import OrderItem
from models.order import OrderStatusLog
from models.order import Shipment
from models.base import utc_now


async def get_orders_by_seller_and_status(
    db: AsyncSession,
    seller_id: int,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
) -> tuple[List[Order], int]:
    query = select(Order).filter(Order.seller_id == seller_id)
    if status:
        query = query.filter(Order.order_status == status)

    # Get total count
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar_one()

    # Get items
    items_query = (
        query.options(
            selectinload(Order.items).selectinload(OrderItem.review),
            selectinload(Order.shipment).selectinload(Shipment.shipping_provider),
            selectinload(Order.user),
        )
        .order_by(Order.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    items_result = await db.execute(items_query)
    items = list(items_result.scalars().all())

    return items, total


async def get_order_by_public_id_and_seller(
    db: AsyncSession, public_id: str, seller_id: int
) -> Optional[Order]:
    query = (
        select(Order)
        .options(
            selectinload(Order.items).selectinload(OrderItem.review),
            selectinload(Order.shipment).selectinload(Shipment.shipping_provider),
            selectinload(Order.user),
        )
        .filter(
            or_(Order.public_id == public_id, Order.order_code == public_id),
            Order.seller_id == seller_id,
        )
    )
    result = await db.execute(query)
    return result.scalar_one_or_none()


async def confirm_order(db: AsyncSession, order: Order) -> Order:
    old_status = order.order_status

    order.seller_confirmed = True
    order.seller_confirmed_at = utc_now()

    # Only transition to READY_TO_SHIP if payment is already PAID.
    # Because COD is not supported in MVP — payment must be online.
    if order.payment_status == "PAID":
        order.order_status = "READY_TO_SHIP"

        # Log the status change
        log = OrderStatusLog(
            order_id=order.id,
            old_status=old_status,
            new_status="READY_TO_SHIP",
            note="Seller confirmed and payment already paid",
        )
        db.add(log)

    await db.flush()
    await db.refresh(order)
    return order


async def update_order_status_to_shipping(db: AsyncSession, order: Order) -> Order:
    old_status = order.order_status
    order.order_status = "SHIPPING"

    # Log the status change
    log = OrderStatusLog(
        order_id=order.id,
        old_status=old_status,
        new_status="SHIPPING",
        note="Seller started shipping",
    )
    db.add(log)

    await db.flush()
    await db.refresh(order)
    return order


async def create_order(db: AsyncSession, order: Order) -> Order:
    db.add(order)
    await db.flush()
    return order


async def add_order_status_log(db: AsyncSession, log: OrderStatusLog) -> OrderStatusLog:
    db.add(log)
    await db.flush()
    return log


async def add_order_cancellation(db: AsyncSession, cancellation) -> None:
    db.add(cancellation)
    await db.flush()


async def get_user_orders(db: AsyncSession, user_id: int) -> list[Order]:
    stmt = (
        select(Order)
        .options(
            selectinload(Order.items).selectinload(OrderItem.review),
            selectinload(Order.seller),
            selectinload(Order.shipment).selectinload(Shipment.shipping_provider),
        )
        .where(Order.user_id == user_id)
        .order_by(Order.created_at.desc())
    )
    res = await db.execute(stmt)
    return list(res.scalars().all())


async def get_order_by_code_and_user(
    db: AsyncSession, order_code: str, user_id: int, is_seller: bool = False
) -> Order | None:
    stmt = (
        select(Order)
        .options(
            selectinload(Order.items).selectinload(OrderItem.review),
            selectinload(Order.seller),
            selectinload(Order.shipment).selectinload(Shipment.shipping_provider),
        )
    )
    if is_seller:
        stmt = stmt.where(Order.order_code == order_code, Order.seller_id == user_id)
    else:
        stmt = stmt.where(Order.order_code == order_code, Order.user_id == user_id)
    res = await db.execute(stmt)
    return res.scalar_one_or_none()


async def get_orders_by_codes_and_user(
    db: AsyncSession, order_codes: list[str], user_id: int
) -> list[Order]:
    stmt = select(Order).where(
        Order.order_code.in_(order_codes), Order.user_id == user_id
    )
    res = await db.execute(stmt)
    return list(res.scalars().all())
