from datetime import datetime
from decimal import Decimal
from typing import Optional, Tuple, List

from fastapi import HTTPException, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models.base import utc_now
from models.catalog.product import Product
from models.inventory.inventory_transaction import InventoryTransaction
from models.order.order import Order
from models.order.order_item import OrderItem
from models.order.order_return import OrderReturn
from models.order.order_status_log import OrderStatusLog
from models.seller.seller_profile import SellerProfile
from models.seller.seller_statistics import SellerStatistics
from models.user.user import User
import repositories.inventory.inventory_repository as inventory_repository
import repositories.order.order_repository as order_repo
import repositories.seller.seller_profile_repository as seller_profile_repository
from repositories.user.user_role_repository import get_role_list_by_user_id
from services.engagement.notification_service import send_notification
from services.wallet.wallet_service import credit_wallet_for_refund


async def _check_supporter_permission(user: User, db: AsyncSession) -> None:
    roles = await get_role_list_by_user_id(user.id, db)
    if not any(role in roles for role in ["ADMIN", "MANAGER", "SUPPORTER"]):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không có quyền truy cập cổng khiếu nại",
        )


async def get_disputes(
    user: User,
    db: AsyncSession,
    status_filter: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
) -> Tuple[List[OrderReturn], int]:
    await _check_supporter_permission(user, db)

    base_where = []
    if status_filter:
        base_where.append(OrderReturn.return_status == status_filter)

    count_stmt = select(func.count(OrderReturn.id))
    if base_where:
        count_stmt = count_stmt.where(*base_where)
    total_res = await db.execute(count_stmt)
    total = int(total_res.scalar() or 0)

    stmt = (
        select(OrderReturn)
        .options(
            selectinload(OrderReturn.order).selectinload(Order.items),
            selectinload(OrderReturn.order).selectinload(Order.shipment),
            selectinload(OrderReturn.order).selectinload(Order.seller),
            selectinload(OrderReturn.order).selectinload(Order.user),
            selectinload(OrderReturn.order).selectinload(Order.status_logs),
            selectinload(OrderReturn.order).selectinload(Order.return_request),
            selectinload(OrderReturn.user),
            selectinload(OrderReturn.seller),
            selectinload(OrderReturn.supporter),
        )
        .order_by(OrderReturn.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    if base_where:
        stmt = stmt.where(*base_where)

    res = await db.execute(stmt)
    items = list(res.scalars().all())
    return items, total


async def get_dispute_detail(
    user: User, dispute_id: str, db: AsyncSession
) -> OrderReturn:
    await _check_supporter_permission(user, db)

    stmt = (
        select(OrderReturn)
        .options(
            selectinload(OrderReturn.order).selectinload(Order.items),
            selectinload(OrderReturn.order).selectinload(Order.status_logs),
            selectinload(OrderReturn.order).selectinload(Order.shipment),
            selectinload(OrderReturn.order).selectinload(Order.seller),
            selectinload(OrderReturn.order).selectinload(Order.user),
            selectinload(OrderReturn.order).selectinload(Order.return_request),
            selectinload(OrderReturn.user),
            selectinload(OrderReturn.seller),
            selectinload(OrderReturn.supporter),
        )
        .where(
            or_(
                OrderReturn.public_id == dispute_id,
                OrderReturn.return_code == dispute_id,
            )
        )
    )
    res = await db.execute(stmt)
    order_return = res.scalar_one_or_none()
    if not order_return:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy thông tin khiếu nại",
        )
    return order_return


async def resolve_dispute(
    user: User, dispute_id: str, decision: str, note: str, db: AsyncSession
) -> OrderReturn:
    await _check_supporter_permission(user, db)

    if decision not in ("APPROVE_REFUND", "REJECT_DISPUTE"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Quyết định không hợp lệ. Chỉ chấp nhận APPROVE_REFUND hoặc REJECT_DISPUTE.",
        )

    if not note or not note.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vui lòng nhập ghi chú phân xử.",
        )

    order_return = await get_dispute_detail(user, dispute_id, db)

    if order_return.return_status != "DISPUTED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Chỉ có thể xử lý khiếu nại ở trạng thái DISPUTED (hiện tại: {order_return.return_status})",
        )

    order_return.supporter_id = user.id
    order_return.supporter_decision = decision
    order_return.supporter_note = note.strip()
    order_return.resolved_at = utc_now()

    order = order_return.order
    old_status = order.order_status

    if decision == "APPROVE_REFUND":
        order_return.return_status = "SUPPORT_APPROVED"
        order.order_status = "RETURNED"
        order.payment_status = "REFUNDED"
        order.return_tag = "RETURN_SUCCESS_SUPPORT_APPROVED"

        await credit_wallet_for_refund(
            user_id=order.user_id,
            amount=order.total_amount,
            order=order,
            db=db,
        )

        for item in order.items:
            if not item.variant_id:
                continue
            inv = await inventory_repository.get_inventory_for_update(db, item.variant_id)
            if inv:
                qty_before = inv.reserved_quantity
                inv.reserved_quantity = max(0, inv.reserved_quantity - item.quantity)
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
                        note=f"Giải phóng tồn kho khóa do đơn {order.order_code} hoàn tiền thành công (Supporter duyệt)",
                    ),
                )

        await order_repo.add_order_status_log(
            db,
            OrderStatusLog(
                order_id=order.id,
                old_status=old_status,
                new_status="RETURNED",
                note=f"Supporter đã duyệt khiếu nại (Đồng ý hoàn tiền). Ghi chú: {note.strip()}",
            ),
        )

        await send_notification(
            db=db,
            user_id=order.user_id,
            type="wallet",
            title="Khiếu nại được chấp thuận",
            content=f"Sàn đã chấp thuận khiếu nại cho đơn {order.order_code}. Tiền hoàn {order.total_amount:,.0f}đ đã được cộng vào ví.",
            action_url="/account/wallet",
        )

        seller_profile = await seller_profile_repository.get_seller_profile_by_id(order.seller_id, db)
        if seller_profile:
            await send_notification(
                db=db,
                user_id=seller_profile.user_id,
                type="order",
                title="Khiếu nại đơn hàng đã được giải quyết",
                content=f"Sàn đã chấp thuận yêu cầu hoàn tiền cho đơn {order.order_code}. Ghi chú: {note.strip()}",
                action_url=f"/seller/orders/{order.order_code}",
            )

    elif decision == "REJECT_DISPUTE":
        order_return.return_status = "SUPPORT_REJECTED"
        order.order_status = "COMPLETED"
        order.completed_at = utc_now()
        order.return_tag = "RETURN_FAILED_SUPPORT_REJECTED"

        for item in order.items:
            if not item.variant_id:
                continue
            inv = await inventory_repository.get_inventory_for_update(db, item.variant_id)
            if inv:
                qty_before = inv.quantity
                inv.quantity = max(0, inv.quantity - item.quantity)
                inv.reserved_quantity = max(0, inv.reserved_quantity - item.quantity)
                qty_after = inv.quantity

                await inventory_repository.add_inventory_transaction(
                    db,
                    InventoryTransaction(
                        variant_id=inv.variant_id,
                        transaction_type="ORDER_DEDUCT",
                        quantity_change=-item.quantity,
                        quantity_before=qty_before,
                        quantity_after=qty_after,
                        reference_type="ORDER",
                        reference_id=order.id,
                        note=f"Trừ tồn kho khi đơn {order.order_code} hoàn thành (Supporter bác bỏ khiếu nại)",
                    ),
                )

            if item.product_id:
                prod = await db.get(Product, item.product_id)
                if prod:
                    prod.sold_count += item.quantity

        seller_stats_res = await db.execute(
            select(SellerStatistics).where(SellerStatistics.seller_id == order.seller_id)
        )
        stats = seller_stats_res.scalar_one_or_none()
        if stats:
            stats.total_sold += sum(i.quantity for i in order.items)
            stats.total_revenue += Decimal(str(order.total_amount))

        await order_repo.add_order_status_log(
            db,
            OrderStatusLog(
                order_id=order.id,
                old_status=old_status,
                new_status="COMPLETED",
                note=f"Supporter đã bác bỏ khiếu nại. Đơn hàng hoàn tất. Ghi chú: {note.strip()}",
            ),
        )

        await send_notification(
            db=db,
            user_id=order.user_id,
            type="order",
            title="Khiếu nại bị từ chối",
            content=f"Sàn đã bác bỏ khiếu nại cho đơn hàng {order.order_code}. Đơn hàng đã hoàn tất. Ghi chú: {note.strip()}",
            action_url=f"/account/orders/{order.order_code}",
        )

        seller_profile = await seller_profile_repository.get_seller_profile_by_id(order.seller_id, db)
        if seller_profile:
            await send_notification(
                db=db,
                user_id=seller_profile.user_id,
                type="order",
                title="Khiếu nại đơn hàng đã được giải quyết",
                content=f"Sàn đã bác bỏ khiếu nại cho đơn hàng {order.order_code}. Doanh thu đã được ghi nhận.",
                action_url=f"/seller/orders/{order.order_code}",
            )

    return order_return
