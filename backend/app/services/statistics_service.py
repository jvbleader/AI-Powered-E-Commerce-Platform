from decimal import Decimal
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from models.order import Order
from models.order import OrderItem
from models.catalog import Product
from models.seller import SellerStatistics
from models.seller import SellerProfile
from models.base import utc_now


async def recalculate_all_statistics(db: AsyncSession) -> dict:
    """
    Hàm tính toán và đồng bộ lại toàn bộ thống kê lượt bán (sold_count) cho Sản Phẩm
    và Thống Kê Shop (total_sold, total_revenue) dựa trên tất cả các đơn hàng COMPLETED.
    Chạy định kỳ 2 lần / ngày (hoặc kích hoạt thủ công từ Admin).
    """
    # 1. Thống kê số lượng bán theo sản phẩm từ các đơn hàng COMPLETED
    product_sales_stmt = (
        select(OrderItem.product_id, func.sum(OrderItem.quantity))
        .join(Order, OrderItem.order_id == Order.id)
        .where(Order.order_status == "COMPLETED")
        .group_by(OrderItem.product_id)
    )
    product_sales_res = await db.execute(product_sales_stmt)
    product_sold_map = dict(product_sales_res.all())

    # Cập nhật sold_count cho tất cả sản phẩm
    prods_stmt = select(Product)
    prods_res = await db.execute(prods_stmt)
    all_products = prods_res.scalars().all()

    updated_products_count = 0
    for prod in all_products:
        expected_sold = product_sold_map.get(prod.id, 0)
        if prod.sold_count != expected_sold:
            prod.sold_count = expected_sold
            updated_products_count += 1

    # 2. Thống kê theo Shop (total_sold, total_revenue) từ các đơn hàng COMPLETED
    seller_items_stmt = (
        select(Order.seller_id, func.sum(OrderItem.quantity))
        .join(OrderItem, OrderItem.order_id == Order.id)
        .where(Order.order_status == "COMPLETED")
        .group_by(Order.seller_id)
    )
    seller_items_res = await db.execute(seller_items_stmt)
    seller_sold_map = dict(seller_items_res.all())

    seller_revenue_stmt = (
        select(Order.seller_id, func.sum(Order.total_amount))
        .where(Order.order_status == "COMPLETED")
        .group_by(Order.seller_id)
    )
    seller_revenue_res = await db.execute(seller_revenue_stmt)
    seller_revenue_map = dict(seller_revenue_res.all())

    # Lấy danh sách tất cả Seller Profiles
    sellers_stmt = select(SellerProfile.id)
    sellers_res = await db.execute(sellers_stmt)
    all_seller_ids = list(sellers_res.scalars().all())

    updated_sellers_count = 0
    for s_id in all_seller_ids:
        sold = seller_sold_map.get(s_id, 0)
        rev = Decimal(str(seller_revenue_map.get(s_id, 0.0) or "0.0"))

        stats_stmt = select(SellerStatistics).where(SellerStatistics.seller_id == s_id)
        stats_res = await db.execute(stats_stmt)
        stats = stats_res.scalar_one_or_none()

        if not stats:
            stats = SellerStatistics(
                seller_id=s_id,
                total_sold=sold,
                total_revenue=rev,
                updated_at=utc_now()
            )
            db.add(stats)
            updated_sellers_count += 1
        else:
            if stats.total_sold != sold or stats.total_revenue != rev:
                stats.total_sold = sold
                stats.total_revenue = rev
                stats.updated_at = utc_now()
                updated_sellers_count += 1

    await db.flush()
    await db.commit()

    return {
        "status": "success",
        "timestamp": utc_now().isoformat(),
        "total_products_checked": len(all_products),
        "products_updated": updated_products_count,
        "total_sellers_checked": len(all_seller_ids),
        "sellers_updated": updated_sellers_count,
    }
