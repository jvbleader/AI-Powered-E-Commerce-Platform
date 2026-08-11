import secrets
from datetime import timedelta
from decimal import Decimal
from typing import List, Dict

from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from models.base import utc_now
from models.inventory import InventoryTransaction
from models.order import Order
from models.order import OrderCancellation
from models.order import OrderItem
from models.order import OrderStatusLog
from models.user import User
from schemas.order.order_schema import CheckoutCartRequest, CheckoutDirectRequest
import repositories.order.order_repository as order_repository
import repositories.inventory.inventory_repository as inventory_repository
import repositories.cart.cart_repository as cart_repository
import repositories.catalog.product_repository as product_repository
import repositories.seller.seller_profile_repository as seller_profile_repository
import repositories.user.user_address_repository as user_address_repository
from services.engagement.notification_service import send_notification


def generate_order_code() -> str:
    return f"ORD-{secrets.token_hex(6).upper()}"


async def _process_checkout(
    user: User,
    items_to_checkout: List[dict],
    address_id: int,
    customer_note: str | None,
    db: AsyncSession,
    payment_method: str | None = None,
    shop_shipping_map: Dict[str, str] | None = None,
) -> List[Order]:
    if not items_to_checkout:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không có sản phẩm nào để thanh toán",
        )

    # Lấy thông tin địa chỉ giao hàng
    address = await user_address_repository.get_address_by_id_and_user(
        db, address_id, user.id
    )
    if not address:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy địa chỉ giao hàng",
        )

    # Lấy danh sách variant_id cần khóa (sắp xếp để tránh deadlock)
    variant_ids = sorted([item["variant"].id for item in items_to_checkout])

    # Khóa Inventory cho các variant này
    inv_list = await inventory_repository.get_inventories_for_update(db, variant_ids)
    inventories = {inv.variant_id: inv for inv in inv_list}

    # Gom nhóm theo seller
    seller_groups: Dict[int, List[dict]] = {}
    for item in items_to_checkout:
        seller_id = item["variant"].product.seller_id
        if seller_id not in seller_groups:
            seller_groups[seller_id] = []
        seller_groups[seller_id].append(item)

    # Lấy thông tin shipping fee của các seller
    seller_ids = list(seller_groups.keys())
    seller_list = await seller_profile_repository.get_sellers_by_ids(seller_ids, db)
    sellers = {s.id: s for s in seller_list}

    created_orders = []

    for seller_id, group_items in seller_groups.items():
        seller = sellers.get(seller_id)
        if not seller:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy Seller {seller_id}",
            )

        # Find shipping provider
        provider_pub_id = None
        if shop_shipping_map:
            provider_pub_id = shop_shipping_map.get(seller.public_id)
        
        selected_provider = None
        if provider_pub_id:
            for p in seller.shipping_providers:
                if p.public_id == provider_pub_id and p.active:
                    selected_provider = p
                    break
            
            if not selected_provider:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Shop {seller.shop_name} không hỗ trợ đơn vị vận chuyển đã chọn",
                )
        else:
            # Fallback to the first available provider if not specified
            if not seller.shipping_providers:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Shop {seller.shop_name} chưa cài đặt đơn vị vận chuyển",
                )
            selected_provider = next((p for p in seller.shipping_providers if p.active), None)
            if not selected_provider:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Shop {seller.shop_name} không có đơn vị vận chuyển nào khả dụng",
                )

        subtotal_amount = Decimal("0.00")
        order_items = []

        for item in group_items:
            variant = item["variant"]
            quantity = item["quantity"]
            inv = inventories.get(variant.id)

            if not inv:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Không tìm thấy thông tin tồn kho cho {variant.variant_name}",
                )

            available_qty = inv.quantity - inv.reserved_quantity
            if available_qty < quantity:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Sản phẩm {variant.variant_name} không đủ tồn kho (còn {available_qty}, yêu cầu {quantity})",
                )

            # Trừ tồn kho (tăng reserved)
            qty_before = inv.reserved_quantity
            inv.reserved_quantity += quantity
            qty_after = inv.reserved_quantity

            unit_price = variant.sale_price if variant.sale_price else variant.price
            subtotal = unit_price * quantity
            subtotal_amount += subtotal

            order_items.append(
                OrderItem(
                    product_id=variant.product_id,
                    variant_id=variant.id,
                    product_name_snapshot=variant.product.name,
                    variant_name_snapshot=variant.variant_name,
                    product_image_snapshot=variant.image_url
                    or variant.product.thumbnail_url,
                    seller_name_snapshot=seller.shop_name,
                    sku_snapshot=variant.sku,
                    unit_price=unit_price,
                    original_price_snapshot=variant.price,
                    quantity=quantity,
                    subtotal=subtotal,
                )
            )

            await inventory_repository.add_inventory_transaction(
                db,
                InventoryTransaction(
                    variant_id=variant.id,
                    transaction_type="ORDER_RESERVE",
                    quantity_change=quantity,
                    quantity_before=qty_before,
                    quantity_after=qty_after,
                    note=f"Reserve for new order",
                ),
            )

        shipping_fee = selected_provider.fixed_fee
        total_amount = subtotal_amount + shipping_fee

        order = Order(
            order_code=generate_order_code(),
            user_id=user.id,
            seller_id=seller_id,
            order_status="PLACED",
            payment_status="PENDING",
            subtotal_amount=subtotal_amount,
            shipping_fee=shipping_fee,
            total_amount=total_amount,
            customer_note=customer_note,
            preferred_payment_method=payment_method,
            payment_expires_at=utc_now() + timedelta(days=1),
            seller_confirm_expires_at=utc_now() + timedelta(days=3),
            items=order_items,
        )

        # Thêm thông tin Shipment
        from models.order import Shipment
        from sqlalchemy import select

        while True:
            digits = "".join(secrets.choice("0123456789") for _ in range(12))
            tracking_code = f"{selected_provider.code}VN{digits}"
            result = await db.execute(select(Shipment.id).where(Shipment.tracking_code == tracking_code))
            if not result.scalar_one_or_none():
                break

        shipment = Shipment(
            receiver_name=address.receiver_name,
            receiver_phone=address.phone,
            province=address.province,
            district=address.district,
            ward=address.ward,
            detail_address=address.detail_address,
            address_type=address.address_type,
            shipping_provider_id=selected_provider.id,
            tracking_code=tracking_code,
        )
        order.shipment = shipment

        await order_repository.create_order(db, order)
        created_orders.append(order)

    for order in created_orders:
        await order_repository.add_order_status_log(
            db,
            OrderStatusLog(
                order_id=order.id, new_status="PLACED", note="Đơn hàng được tạo mới"
            ),
        )
        # Notify buyer
        await send_notification(
            db=db,
            user_id=user.id,
            type="order",
            title=f"Đặt hàng thành công",
            content=f"Đơn hàng {order.order_code} đã được đặt thành công.",
            action_url=f"/account/orders/{order.order_code}"
        )
        # Notify seller
        seller_user_id = sellers[order.seller_id].user_id
        await send_notification(
            db=db,
            user_id=seller_user_id,
            type="order",
            title=f"Đơn hàng mới!",
            content=f"Bạn vừa nhận được đơn hàng mới {order.order_code}.",
            action_url=f"/seller/orders/{order.order_code}"
        )

    # Xóa các cart items đã mua (nếu từ giỏ hàng)
    cart_item_ids = [
        item["cart_item_id"] for item in items_to_checkout if item.get("cart_item_id")
    ]
    if cart_item_ids:
        await cart_repository.remove_cart_items_by_ids(db, cart_item_ids)

    return created_orders


async def checkout_from_cart(user: User, data: CheckoutCartRequest, db: AsyncSession):
    cart_items = await cart_repository.get_cart_items_for_checkout(
        db, user.id, data.cart_item_ids
    )

    if not cart_items:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy sản phẩm hợp lệ trong giỏ hàng để thanh toán",
        )

    items_to_checkout = [
        {"variant": ci.variant, "quantity": ci.quantity, "cart_item_id": ci.id}
        for ci in cart_items
    ]

    shop_shipping_map = {sp.shop_public_id: sp.shipping_provider_public_id for sp in data.shipping_providers}
    
    orders = await _process_checkout(
        user, items_to_checkout, data.address_id, data.customer_note, db, data.payment_method, shop_shipping_map
    )
    for o in orders:
        await db.refresh(o, ["items", "seller", "shipment"])
    return orders


async def checkout_direct(user: User, data: CheckoutDirectRequest, db: AsyncSession):
    variant_ids = [item.variant_id for item in data.items]
    variants_list = await product_repository.get_variants_for_checkout(db, variant_ids)
    variants = {v.id: v for v in variants_list}

    items_to_checkout = []
    for req_item in data.items:
        variant = variants.get(req_item.variant_id)
        if not variant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Không tìm thấy phân loại sản phẩm {req_item.variant_id} hoặc ngừng kinh doanh",
            )
        items_to_checkout.append(
            {"variant": variant, "quantity": req_item.quantity, "cart_item_id": None}
        )

    shop_shipping_map = None
    if data.shipping_provider_public_id and variants:
        # Get seller_public_id from the first variant (assuming single shop for direct checkout)
        first_variant = list(variants.values())[0]
        shop_shipping_map = {first_variant.product.seller.public_id: data.shipping_provider_public_id}

    orders = await _process_checkout(
        user, items_to_checkout, data.address_id, data.customer_note, db, data.payment_method, shop_shipping_map
    )
    for o in orders:
        await db.refresh(o, ["items", "seller", "shipment"])
    return orders


async def get_user_orders(user: User, db: AsyncSession):
    return await order_repository.get_user_orders(db, user.id)


async def get_order_detail(user: User, order_code: str, db: AsyncSession):
    order = await order_repository.get_order_by_code_and_user(db, order_code, user.id)
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Đơn hàng không tồn tại"
        )
    return order


async def confirm_receipt(user: User, order_code: str, db: AsyncSession):
    order = await get_order_detail(user, order_code, db)

    if order.order_status not in ["SHIPPING"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Không thể xác nhận nhận hàng ở trạng thái {order.order_status}",
        )

    old_status = order.order_status
    order.order_status = "COMPLETED"
    order.completed_at = utc_now()

    await order_repository.add_order_status_log(
        db,
        OrderStatusLog(
            order_id=order.id,
            old_status=old_status,
            new_status="COMPLETED",
            note="Khách hàng xác nhận đã nhận hàng",
        ),
    )

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
                    note=f"Trừ tồn kho khi đơn {order_code} hoàn thành",
                ),
            )

        # Update product sold_count
        if item.product_id:
            from models.catalog import Product
            prod = await db.get(Product, item.product_id)
            if prod:
                prod.sold_count += item.quantity

    # Update seller statistics (total_sold & total_revenue)
    from models.seller import SellerStatistics
    from sqlalchemy import select
    seller_stats_res = await db.execute(select(SellerStatistics).where(SellerStatistics.seller_id == order.seller_id))
    stats = seller_stats_res.scalar_one_or_none()
    if stats:
        stats.total_sold += sum(i.quantity for i in order.items)
        stats.total_revenue += Decimal(str(order.total_amount))

    # Lấy seller user_id
    from repositories.seller.seller_profile_repository import get_seller_profile_by_id
    seller = await get_seller_profile_by_id(order.seller_id, db)
    if seller:
        await send_notification(
            db=db,
            user_id=seller.user_id,
            type="order",
            title="Đơn hàng đã giao thành công",
            content=f"Người mua đã xác nhận nhận được đơn hàng {order_code}.",
            action_url=f"/seller/orders/{order.order_code}"
        )

    return order


async def cancel_order(user: User, order_code: str, reason: str, db: AsyncSession):
    order = await get_order_detail(user, order_code, db)

    if order.order_status not in ["PLACED", "READY_TO_SHIP"]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Không thể hủy đơn hàng ở trạng thái {order.order_status}",
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
            note="Khách hàng hủy đơn",
        ),
    )

    await order_repository.add_order_cancellation(
        db,
        OrderCancellation(
            order_id=order.id,
            cancelled_by_user_id=user.id,
            cancelled_by_type="CUSTOMER",
            reason=reason,
        ),
    )

    if order.payment_status == "PAID":
        order.payment_status = "REFUND_PENDING"

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
                    note=f"Hoàn tồn kho khóa do đơn {order_code} hủy",
                ),
            )

    from repositories.seller.seller_profile_repository import get_seller_profile_by_id
    seller = await get_seller_profile_by_id(order.seller_id, db)
    if seller:
        await send_notification(
            db=db,
            user_id=seller.user_id,
            type="order",
            title="Đơn hàng bị hủy",
            content=f"Đơn hàng {order_code} đã bị người mua hủy.",
            action_url=f"/seller/orders/{order.order_code}"
        )

    return order


async def process_expired_orders(db: AsyncSession) -> dict:
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    now = utc_now()
    expired_payment_count = 0
    expired_confirm_count = 0

    # 1. Hủy các đơn hàng quá hạn thanh toán (payment_expires_at < now và payment_status == 'PENDING')
    stmt_payment = (
        select(Order)
        .options(
            selectinload(Order.items),
        )
        .where(
            Order.payment_expires_at < now,
            Order.payment_status == "PENDING",
            Order.order_status.in_(["PLACED", "PENDING"]),
        )
    )
    payment_orders_res = await db.execute(stmt_payment)
    payment_expired_orders = list(payment_orders_res.scalars().all())

    for order in payment_expired_orders:
        old_status = order.order_status
        order.order_status = "CANCELLED"
        order.payment_status = "FAILED"
        order.cancelled_at = now

        await order_repository.add_order_status_log(
            db,
            OrderStatusLog(
                order_id=order.id,
                old_status=old_status,
                new_status="CANCELLED",
                note="Hệ thống tự động hủy đơn do hết hạn thanh toán (quá 1 ngày)",
            ),
        )

        await order_repository.add_order_cancellation(
            db,
            OrderCancellation(
                order_id=order.id,
                cancelled_by_user_id=order.user_id,
                cancelled_by_type="SYSTEM",
                reason="Hệ thống tự động hủy do hết hạn thanh toán (quá 1 ngày)",
            ),
        )

        # Hoàn trả tồn kho giữ chỗ (reserved_quantity)
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
                        note=f"Tự động hoàn tồn kho do đơn {order.order_code} hết hạn thanh toán",
                    ),
                )
        expired_payment_count += 1

    # 2. Hủy các đơn hàng quá hạn Shop xác nhận (seller_confirm_expires_at < now và seller_confirmed == False)
    stmt_seller = (
        select(Order)
        .options(
            selectinload(Order.items),
        )
        .where(
            Order.seller_confirm_expires_at < now,
            Order.seller_confirmed == False,
            Order.order_status.in_(["PLACED", "READY_TO_SHIP"]),
        )
    )
    seller_orders_res = await db.execute(stmt_seller)
    seller_expired_orders = list(seller_orders_res.scalars().all())

    for order in seller_expired_orders:
        old_status = order.order_status
        order.order_status = "CANCELLED"
        order.cancelled_at = now

        if order.payment_status == "PAID":
            order.payment_status = "REFUND_PENDING"

        await order_repository.add_order_status_log(
            db,
            OrderStatusLog(
                order_id=order.id,
                old_status=old_status,
                new_status="CANCELLED",
                note="Hệ thống tự động hủy đơn do Shop không xác nhận (quá 3 ngày)",
            ),
        )

        await order_repository.add_order_cancellation(
            db,
            OrderCancellation(
                order_id=order.id,
                cancelled_by_user_id=order.user_id,
                cancelled_by_type="SYSTEM",
                reason="Hệ thống tự động hủy do Shop không xác nhận đơn (quá 3 ngày)",
            ),
        )

        # Hoàn trả tồn kho giữ chỗ (reserved_quantity)
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
                        note=f"Tự động hoàn tồn kho do đơn {order.order_code} hết hạn shop xác nhận",
                    ),
                )
        expired_confirm_count += 1

    if expired_payment_count > 0 or expired_confirm_count > 0:
        await db.commit()

    return {
        "expired_payments": expired_payment_count,
        "expired_seller_confirms": expired_confirm_count,
    }

