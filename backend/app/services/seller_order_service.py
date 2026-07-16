from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from repositories.order_repository import (
    get_orders_by_seller_and_status,
    get_order_by_public_id_and_seller,
    confirm_order,
    update_order_status_to_shipping,
)
from repositories.seller_profile_repository import get_seller_profile_by_user_id
from schemas.seller_order_schema import OrderListResponse, OrderResponse
from models.user import User
from models.base import utc_now
from models.order_status_log import OrderStatusLog
from models.order_cancellation import OrderCancellation
from models.inventory_transaction import InventoryTransaction
from repositories import inventory_repository, order_repository


async def _get_active_seller_profile(user: User, db: AsyncSession):
    seller_profile = await get_seller_profile_by_user_id(user.id, db)
    if not seller_profile or seller_profile.status != "APPROVED":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have an approved seller account.",
        )
    return seller_profile


async def get_seller_orders(
    user: User,
    db: AsyncSession,
    status_filter: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
) -> OrderListResponse:
    seller_profile = await _get_active_seller_profile(user, db)

    items, total = await get_orders_by_seller_and_status(
        db, seller_profile.id, status_filter, skip, limit
    )

    return OrderListResponse(
        items=[OrderResponse.model_validate(item) for item in items], total=total
    )


async def get_seller_order_detail(
    user: User, order_id: str, db: AsyncSession
) -> OrderResponse:
    seller_profile = await _get_active_seller_profile(user, db)

    order = await get_order_by_public_id_and_seller(db, order_id, seller_profile.id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Order not found"
        )
    return OrderResponse.model_validate(order)


async def confirm_seller_order(
    user: User, order_id: str, db: AsyncSession
) -> OrderResponse:
    seller_profile = await _get_active_seller_profile(user, db)

    order = await get_order_by_public_id_and_seller(db, order_id, seller_profile.id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Order not found"
        )

    if order.seller_confirmed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order has already been confirmed.",
        )

    if order.order_status not in ("PLACED",):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Order cannot be confirmed because it is in {order.order_status} status.",
        )

    confirmed_order = await confirm_order(db, order)
    return OrderResponse.model_validate(confirmed_order)


async def update_order_to_shipping(
    user: User, order_id: str, db: AsyncSession
) -> OrderResponse:
    seller_profile = await _get_active_seller_profile(user, db)

    order = await get_order_by_public_id_and_seller(db, order_id, seller_profile.id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Order not found"
        )

    if order.order_status != "READY_TO_SHIP":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Order cannot be shipped because it is in {order.order_status} status.",
        )

    shipped_order = await update_order_status_to_shipping(db, order)
    return OrderResponse.model_validate(shipped_order)


async def cancel_seller_order(
    user: User, order_id: str, reason: str, db: AsyncSession
) -> OrderResponse:
    seller_profile = await _get_active_seller_profile(user, db)

    order = await get_order_by_public_id_and_seller(db, order_id, seller_profile.id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Order not found"
        )

    if order.seller_confirmed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không thể từ chối đơn hàng đã xác nhận.",
        )

    if order.payment_status == "PAID":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không thể từ chối đơn hàng đã thanh toán.",
        )

    if order.order_status != "PLACED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Không thể từ chối đơn hàng ở trạng thái {order.order_status}",
        )

    old_status = order.order_status
    order.order_status = "CANCELLED"
    order.cancelled_at = utc_now()

    await order_repository.add_order_status_log(
        db,
        OrderStatusLog(
            order_id=order.id,
            old_status=old_status,
            new_status="CANCELLED",
            note="Shop từ chối đơn",
        ),
    )

    await order_repository.add_order_cancellation(
        db,
        OrderCancellation(
            order_id=order.id,
            cancelled_by_user_id=user.id,
            cancelled_by_type="SELLER",
            reason=reason,
        ),
    )

    for item in order.items:
        if not item.variant_id:
            continue
        inv = await inventory_repository.get_inventory_for_update(db, item.variant_id)
        if inv:
            qty_before = inv.reserved_quantity
            inv.reserved_quantity -= item.quantity
            qty_after = inv.reserved_quantity

            await inventory_repository.add_inventory_transaction(
                db,
                InventoryTransaction(
                    variant_id=inv.variant_id,
                    transaction_type="CANCEL_RELEASE",
                    quantity_change=-item.quantity,
                    quantity_before=qty_before,
                    quantity_after=qty_after,
                    reference_type="ORDER",
                    reference_id=order.id,
                    note=f"Hoàn tồn kho khóa do shop từ chối đơn",
                ),
            )

    return OrderResponse.model_validate(order)
