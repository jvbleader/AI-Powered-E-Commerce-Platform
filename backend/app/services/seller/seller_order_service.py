import secrets
from decimal import Decimal
from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy import select, func, text
from sqlalchemy.ext.asyncio import AsyncSession
from repositories.order.order_repository import (
    get_orders_by_seller_and_status,
    get_order_by_public_id_and_seller,
    confirm_order,
    update_order_status_to_shipping,
    update_order_status_to_delivered,
)
from repositories.seller.seller_profile_repository import get_seller_profile_by_user_id
from schemas.seller.seller_order_schema import OrderListResponse, OrderResponse
from schemas.seller.seller_application_schema import SellerDashboardSummaryResponse
from schemas.order.order_return_schema import OrderReturnResponse, ReturnRejectRequest
from models.user import User
from models.order import Order
from models.order import OrderItem
from models.order import OrderReturn
from models.catalog import Product
from models.seller import SellerStatistics
from models.base import utc_now
from models.order import OrderStatusLog
from models.order import OrderCancellation
from models.inventory import InventoryTransaction
import repositories.inventory.inventory_repository as inventory_repository
import repositories.order.order_repository as order_repository
from services.engagement.notification_service import send_notification
from services.wallet.wallet_service import credit_wallet_for_refund


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
    customer_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
) -> OrderListResponse:
    seller_profile = await _get_active_seller_profile(user, db)

    items, total = await get_orders_by_seller_and_status(
        db, seller_profile.id, status_filter, customer_id, skip, limit
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

    if order.order_status not in ("PLACED",):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Order cannot be confirmed because it is in {order.order_status} status.",
        )

    confirmed_order = await confirm_order(db, order)
    
    # Notify buyer
    await send_notification(
        db=db,
        user_id=order.user_id,
        type="order",
        title="Đơn hàng đã được xác nhận",
        content=f"Đơn hàng {order.order_code} đã được shop xác nhận và đang được chuẩn bị.",
        action_url=f"/account/orders/{order.order_code}"
    )
    
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
    
    # Notify buyer
    await send_notification(
        db=db,
        user_id=order.user_id,
        type="order",
        title="Đơn hàng đang giao",
        content=f"Đơn hàng {order.order_code} đã được giao cho đơn vị vận chuyển.",
        action_url=f"/account/orders/{order.order_code}"
    )
    
    return OrderResponse.model_validate(shipped_order)


async def update_order_to_delivered(
    user: User, order_id: str, db: AsyncSession
) -> OrderResponse:
    seller_profile = await _get_active_seller_profile(user, db)

    order = await get_order_by_public_id_and_seller(db, order_id, seller_profile.id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Order not found"
        )

    if order.order_status != "SHIPPING":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Chỉ có thể chuyển sang đã giao hàng khi đơn đang giao (SHIPPING)",
        )

    delivered_order = await update_order_status_to_delivered(db, order)

    # Notify buyer
    await send_notification(
        db=db,
        user_id=order.user_id,
        type="order",
        title="Đơn hàng đã được giao",
        content=f"Đơn hàng {order.order_code} đã được giao tới bạn. Vui lòng kiểm tra và xác nhận nhận hàng trong vòng 7 ngày.",
        action_url=f"/account/orders/{order.order_code}",
    )

    return OrderResponse.model_validate(delivered_order)


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
                    note=f"Hoàn tồn kho khóa do shop từ chối đơn",
                ),
            )

    # Notify buyer
    await send_notification(
        db=db,
        user_id=order.user_id,
        type="order",
        title="Đơn hàng bị từ chối",
        content=f"Rất tiếc, đơn hàng {order.order_code} đã bị shop từ chối với lý do: {reason}",
        action_url=f"/account/orders/{order.order_code}"
    )

    return OrderResponse.model_validate(order)


async def get_seller_dashboard_summary(
    user: User, db: AsyncSession, recalculate: bool = False
) -> SellerDashboardSummaryResponse:
    seller_profile = await _get_active_seller_profile(user, db)
    seller_id = seller_profile.id

    from datetime import UTC, datetime

    now_aware = datetime.now(UTC)
    now_naive = utc_now()

    # Real-time counts for pending orders & products
    pending_stmt = (
        select(func.count(Order.id))
        .where(
            Order.seller_id == seller_id,
            Order.order_status == "PLACED",
            Order.seller_confirmed.is_(False),
        )
    )
    pending_res = await db.execute(pending_stmt)
    pending_orders = int(pending_res.scalar() or 0)

    prod_stmt = (
        select(func.count(Product.id))
        .where(Product.seller_id == seller_id, Product.status != "DELETED")
    )
    prod_res = await db.execute(prod_stmt)
    total_products = int(prod_res.scalar() or 0)

    stats_stmt = select(SellerStatistics).where(SellerStatistics.seller_id == seller_id)
    stats_res = await db.execute(stats_stmt)
    stats = stats_res.scalar_one_or_none()

    # If GET request (recalculate=False) and stats already exists, return saved stats without recalculating or modifying updated_at
    if not recalculate:
        if stats:
            last_updated = stats.updated_at
            if last_updated and last_updated.tzinfo is None:
                last_updated = last_updated.replace(tzinfo=UTC)
            return SellerDashboardSummaryResponse(
                total_revenue=float(stats.total_revenue or 0.0),
                total_sold=stats.total_sold or 0,
                pending_orders=pending_orders,
                total_products=total_products,
                updated_at=last_updated,
            )

    # If recalculate=True, enforce 5-minute cooldown check against last recalculate timestamp
    if recalculate and stats and getattr(stats, "updated_at", None):
        updated_at = stats.updated_at
        if updated_at is not None:
            if updated_at.tzinfo is None:
                updated_at = updated_at.replace(tzinfo=UTC)
            elapsed_seconds = (now_aware - updated_at).total_seconds()
            if elapsed_seconds < 300:
                remaining_seconds = int(300 - elapsed_seconds)
                remaining_minutes = max(1, (remaining_seconds + 59) // 60)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Bạn chỉ có thể cập nhật dữ liệu 5 phút một lần. Vui lòng thử lại sau {remaining_minutes} phút."
                )

    # Recalculate total_sold & total_revenue from database orders
    sold_stmt = (
        select(func.coalesce(func.sum(OrderItem.quantity), 0))
        .join(Order, OrderItem.order_id == Order.id)
        .where(Order.seller_id == seller_id, Order.order_status == "COMPLETED")
    )
    sold_res = await db.execute(sold_stmt)
    total_sold = int(sold_res.scalar() or 0)

    rev_stmt = (
        select(func.coalesce(func.sum(Order.total_amount), 0))
        .where(Order.seller_id == seller_id, Order.order_status == "COMPLETED")
    )
    rev_res = await db.execute(rev_stmt)
    total_revenue = float(rev_res.scalar() or 0.0)

    if not stats:
        stats = SellerStatistics(
            seller_id=seller_id,
            total_sold=total_sold,
            total_revenue=Decimal(str(total_revenue)),
            updated_at=now_naive,
        )
        db.add(stats)
    else:
        stats.total_sold = total_sold
        stats.total_revenue = Decimal(str(total_revenue))
        stats.updated_at = now_naive

    await db.flush()

    return SellerDashboardSummaryResponse(
        total_revenue=total_revenue,
        total_sold=total_sold,
        pending_orders=pending_orders,
        total_products=total_products,
        updated_at=now_aware,
    )

async def increment_print_count(
    user: User, order_id: str, db: AsyncSession
) -> OrderResponse:
    seller_profile = await _get_active_seller_profile(user, db)

    order = await get_order_by_public_id_and_seller(db, order_id, seller_profile.id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Đơn hàng không tồn tại"
        )
    
    if order.order_status != "SHIPPING":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Chỉ có thể in lại khi đơn ở trạng thái đang giao hàng (SHIPPING)",
        )

    if order.print_count >= 2:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Đã vượt quá số lần in lại cho phép (Tối đa 2 lần).",
        )
        
    order.print_count += 1
    # db.commit() will be called in router
    return OrderResponse.model_validate(order)


async def approve_order_return(
    user: User, order_id: str, db: AsyncSession
) -> OrderReturn:
    seller_profile = await _get_active_seller_profile(user, db)

    order = await get_order_by_public_id_and_seller(db, order_id, seller_profile.id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Order not found"
        )

    return_req = await order_repository.get_order_return_by_order_id(db, order.id)
    if not return_req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy yêu cầu trả hàng cho đơn này",
        )

    if return_req.return_status != "REQUESTED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Không thể duyệt yêu cầu trả hàng ở trạng thái {return_req.return_status}",
        )

    digits = "".join(secrets.choice("0123456789") for _ in range(8))
    tracking_code = f"RET-SPX-{digits}"
    return_req.return_tracking_code = tracking_code
    return_req.return_shipping_provider = "SPX Express (Thu gom trả hàng sàn)"

    if order.shipment:
        return_req.pickup_address = (
            f"{order.shipment.receiver_name} ({order.shipment.receiver_phone}), "
            f"{order.shipment.detail_address}, {order.shipment.ward}, "
            f"{order.shipment.district}, {order.shipment.province}"
        )
    return_req.return_address = (
        getattr(seller_profile, "pickup_address", None) or f"Kho Shop {seller_profile.shop_name}"
    )
    return_req.return_status = "SELLER_APPROVED"
    return_req.seller_responded_at = utc_now()

    await order_repository.add_order_status_log(
        db,
        OrderStatusLog(
            order_id=order.id,
            old_status=order.order_status,
            new_status=order.order_status,
            note=f"Shop đã chấp thuận yêu cầu trả hàng. Mã vận đơn thu gom: {tracking_code}",
        ),
    )

    await send_notification(
        db=db,
        user_id=order.user_id,
        type="order",
        title="Yêu cầu trả hàng được chấp thuận",
        content=f"Shop đã chấp thuận yêu cầu trả hàng cho đơn {order.order_code}. Mã vận đơn hoàn: {tracking_code}.",
        action_url=f"/account/orders/{order.order_code}",
    )

    return return_req


async def reject_order_return(
    user: User, order_id: str, data: ReturnRejectRequest, db: AsyncSession
) -> OrderReturn:
    seller_profile = await _get_active_seller_profile(user, db)

    order = await get_order_by_public_id_and_seller(db, order_id, seller_profile.id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Order not found"
        )

    return_req = await order_repository.get_order_return_by_order_id(db, order.id)
    if not return_req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy yêu cầu trả hàng cho đơn này",
        )

    if return_req.return_status != "REQUESTED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Không thể từ chối yêu cầu trả hàng ở trạng thái {return_req.return_status}",
        )

    return_req.return_status = "SELLER_REJECTED"
    return_req.seller_reject_reason = data.reject_reason
    return_req.seller_responded_at = utc_now()
    order.return_tag = "RETURN_FAILED_SELLER_REJECTED"

    await order_repository.add_order_status_log(
        db,
        OrderStatusLog(
            order_id=order.id,
            old_status=order.order_status,
            new_status=order.order_status,
            note=f"Shop từ chối yêu cầu trả hàng: {data.reject_reason}",
        ),
    )

    await send_notification(
        db=db,
        user_id=order.user_id,
        type="order",
        title="Yêu cầu trả hàng bị từ chối",
        content=f"Shop đã từ chối yêu cầu trả hàng cho đơn {order.order_code}. Lý do: {data.reject_reason}.",
        action_url=f"/account/orders/{order.order_code}",
    )

    return return_req


async def confirm_received_return(
    user: User, order_id: str, db: AsyncSession
) -> OrderReturn:
    seller_profile = await _get_active_seller_profile(user, db)

    order = await get_order_by_public_id_and_seller(db, order_id, seller_profile.id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Order not found"
        )

    return_req = await order_repository.get_order_return_by_order_id(db, order.id)
    if not return_req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy yêu cầu trả hàng cho đơn này",
        )

    if return_req.return_status not in ("SELLER_APPROVED", "RETURNING", "SUPPORT_APPROVED"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Không thể xác nhận nhận hàng hoàn khi yêu cầu ở trạng thái {return_req.return_status}",
        )

    return_req.return_status = "COMPLETED"
    return_req.resolved_at = utc_now()

    old_order_status = order.order_status
    order.order_status = "RETURNED"
    order.payment_status = "REFUNDED"
    order.return_tag = "RETURN_SUCCESS"

    # Refund wallet
    await credit_wallet_for_refund(
        user_id=order.user_id,
        amount=order.total_amount,
        order=order,
        db=db,
    )
    from services.platform.platform_finance_service import record_order_refund
    await record_order_refund(db, order, order.total_amount, "Shop xác nhận nhận hàng hoàn")

    # Restock inventory
    for item in order.items:
        if not item.variant_id:
            continue
        inv = await inventory_repository.get_inventory_for_update(db, item.variant_id)
        if inv:
            qty_before = inv.quantity
            inv.quantity += item.quantity
            qty_after = inv.quantity

            await inventory_repository.add_inventory_transaction(
                db,
                InventoryTransaction(
                    variant_id=inv.variant_id,
                    transaction_type="CANCEL_RELEASE",
                    quantity_change=item.quantity,
                    quantity_before=qty_before,
                    quantity_after=qty_after,
                    reference_type="ORDER",
                    reference_id=order.id,
                    note=f"Hoàn tồn kho do đơn {order.order_code} trả hàng thành công",
                ),
            )
        if item.product_id:
            prod = await db.get(Product, item.product_id)
            if prod and prod.sold_count >= item.quantity:
                prod.sold_count -= item.quantity

    # Deduct seller statistics
    seller_stats_res = await db.execute(
        select(SellerStatistics).where(SellerStatistics.seller_id == order.seller_id)
    )
    stats = seller_stats_res.scalar_one_or_none()
    if stats:
        stats.total_sold = max(0, stats.total_sold - sum(i.quantity for i in order.items))
        stats.total_revenue = max(Decimal("0.00"), stats.total_revenue - Decimal(str(order.total_amount)))

    await order_repository.add_order_status_log(
        db,
        OrderStatusLog(
            order_id=order.id,
            old_status=old_order_status,
            new_status="RETURNED",
            note="Shop đã nhận lại hàng hoàn. Đã hoàn tiền về ví cho người mua.",
        ),
    )

    await send_notification(
        db=db,
        user_id=order.user_id,
        type="wallet",
        title="Hoàn tiền trả hàng thành công",
        content=f"Shop đã nhận lại hàng và hoàn tiền {order.total_amount:,.0f}đ vào ví cho đơn hàng {order.order_code}.",
        action_url="/account/wallet",
    )

    return return_req

