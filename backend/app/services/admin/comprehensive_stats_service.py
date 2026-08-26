from datetime import date, datetime, time, timedelta
from decimal import Decimal
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import and_, case, func, or_, select, distinct, text
from sqlalchemy.ext.asyncio import AsyncSession

from models.catalog.category import Category
from models.catalog.product import Product
from models.catalog.product_category import ProductCategory
from models.catalog.product_image import ProductImage
from models.catalog.product_review import ProductReview
from models.engagement.traffic_log import TrafficLog
from models.moderation.moderation_log import ModerationLog
from models.moderation.violation_report import ViolationReport
from models.order.order import Order
from models.order.order_item import OrderItem
from models.order.order_return import OrderReturn
from models.order.order_status_log import OrderStatusLog
from models.payment.refund import Refund
from models.seller.seller_profile import SellerProfile
from models.user.user import User
from models.user.user_role import UserRole
from schemas.admin.admin_schema import (
    AdminActionCountsResponse,
    AdminBottomSummary,
    AdminComprehensiveDashboardResponse,
    AdminDemographicsResponse,
    AdminFinanceDonutItem,
    AdminHeroKpisResponse,
    AdminHourlyHeatmapCell,
    AdminKpiDelta,
    AdminMicroKpisResponse,
    AdminOrderStatusDonutItem,
    AdminPaymentDonutItem,
    AdminPlatformFinanceOverview,
    AdminRecentActivityItem,
    AdminRevenueSeriesPoint,
    AdminSystemAlertItem,
    AdminTopCategory,
    AdminTopProductDetailed,
    AdminTopSellerDetailed,
    AdminTrafficSourceItem,
    AdminUserGrowthSeriesPoint,
)
from services.platform.platform_finance_service import get_platform_finance_analytics


def compute_delta_pct(current: float | Decimal, previous: float | Decimal) -> Optional[float]:
    c = float(current or 0)
    p = float(previous or 0)
    if p <= 0:
        return 100.0 if c > 0 else 0.0
    return round(((c - p) / p) * 100, 1)


async def get_action_counts(db: AsyncSession) -> AdminActionCountsResponse:
    """Đếm số lượng các tác vụ quản trị thực tế từ CSDL cần xử lý ngay."""
    # 1. Hồ sơ seller chờ duyệt
    pending_sellers = (
        await db.scalar(
            select(func.count(SellerProfile.id)).where(SellerProfile.status == "PENDING")
        )
    ) or 0

    # 2. Báo cáo vi phạm chờ xử lý
    pending_violations = (
        await db.scalar(
            select(func.count(ViolationReport.id)).where(ViolationReport.status == "PENDING")
        )
    ) or 0

    # 3. Đề xuất danh mục chờ duyệt
    from models.catalog.category_suggestion import CategorySuggestion

    pending_categories = (
        await db.scalar(
            select(func.count(CategorySuggestion.id)).where(
                CategorySuggestion.status == "PENDING"
            )
        )
    ) or 0

    # 4. Khiếu nại / Đổi trả chờ xử lý
    pending_disputes = (
        await db.scalar(
            select(func.count(OrderReturn.id)).where(
                OrderReturn.return_status.in_(["REQUESTED", "SELLER_REJECTED", "DISPUTED"])
            )
        )
    ) or 0

    # 5. Đơn hàng lỗi thanh toán
    failed_orders = (
        await db.scalar(
            select(func.count(Order.id)).where(
                Order.order_status.in_(["PAYMENT_FAILED", "DELIVERY_FAILED"])
            )
        )
    ) or 0

    return AdminActionCountsResponse(
        pending_seller_applications=pending_sellers,
        pending_violation_reports=pending_violations,
        pending_category_suggestions=pending_categories,
        pending_disputes=pending_disputes,
        failed_payment_orders=failed_orders,
    )


async def get_comprehensive_admin_stats(
    db: AsyncSession,
    time_preset: str = "7DAYS",
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
) -> AdminComprehensiveDashboardResponse:
    now = datetime.utcnow()

    # Xác định khoảng thời gian kỳ hiện tại (Current) và kỳ trước (Previous)
    if time_preset == "TODAY":
        cur_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        cur_end = now
        delta_span = timedelta(days=1)
        prev_start = cur_start - delta_span
        prev_end = cur_start
        point_type = "HOURLY"
    elif time_preset == "30DAYS":
        delta_span = timedelta(days=30)
        cur_start = now - delta_span
        cur_end = now
        prev_start = cur_start - delta_span
        prev_end = cur_start
        point_type = "DAILY"
    elif time_preset == "12MONTHS":
        delta_span = timedelta(days=365)
        cur_start = now - delta_span
        cur_end = now
        prev_start = cur_start - delta_span
        prev_end = cur_start
        point_type = "MONTHLY"
    elif time_preset == "ALL":
        min_order_date = await db.scalar(select(func.min(Order.created_at)))
        min_user_date = await db.scalar(select(func.min(User.created_at)))
        valid_dates = [d for d in [min_order_date, min_user_date] if d is not None]
        if valid_dates:
            earliest = min(valid_dates)
            cur_start = earliest.replace(hour=0, minute=0, second=0, microsecond=0)
        else:
            cur_start = now - timedelta(days=365)
        cur_end = now
        prev_start = cur_start
        prev_end = cur_start

        total_months = (cur_end.year - cur_start.year) * 12 + (cur_end.month - cur_start.month) + 1
        if total_months <= 24:
            point_type = "MONTHLY"
        elif total_months <= 60:
            point_type = "QUARTERLY"
        else:
            point_type = "YEARLY"
    else:  # Default '7DAYS'
        delta_span = timedelta(days=7)
        cur_start = now - delta_span
        cur_end = now
        prev_start = cur_start - delta_span
        prev_end = cur_start
        point_type = "DAILY"

    if start_date and end_date:
        try:
            cur_start = datetime.fromisoformat(start_date)
            cur_end = datetime.fromisoformat(end_date)
            span = cur_end - cur_start
            prev_start = cur_start - span
            prev_end = cur_start
            days_span = span.days
            if days_span <= 2:
                point_type = "HOURLY"
            elif days_span <= 62:
                point_type = "DAILY"
            elif days_span <= 730:
                point_type = "MONTHLY"
            elif days_span <= 1825:
                point_type = "QUARTERLY"
            else:
                point_type = "YEARLY"
        except Exception:
            pass

    # ==========================================
    # 1. HERO KPIS (100% từ CSDL)
    # ==========================================
    # Doanh thu thực nhận
    cur_rev_stmt = select(func.coalesce(func.sum(Order.total_amount), Decimal("0"))).where(
        and_(
            Order.order_status == "COMPLETED",
            Order.completed_at >= cur_start,
            Order.completed_at <= cur_end,
        )
    )
    cur_rev = (await db.scalar(cur_rev_stmt)) or Decimal("0")

    prev_rev_stmt = select(func.coalesce(func.sum(Order.total_amount), Decimal("0"))).where(
        and_(
            Order.order_status == "COMPLETED",
            Order.completed_at >= prev_start,
            Order.completed_at < cur_start,
        )
    )
    prev_rev = (await db.scalar(prev_rev_stmt)) or Decimal("0")

    # Đơn hàng
    cur_ord_stmt = select(func.count(Order.id)).where(
        and_(Order.created_at >= cur_start, Order.created_at <= cur_end)
    )
    cur_orders = (await db.scalar(cur_ord_stmt)) or 0

    prev_ord_stmt = select(func.count(Order.id)).where(
        and_(Order.created_at >= prev_start, Order.created_at < cur_start)
    )
    prev_orders = (await db.scalar(prev_ord_stmt)) or 0

    # User mới
    cur_users_stmt = select(func.count(User.id)).where(
        and_(User.created_at >= cur_start, User.created_at <= cur_end)
    )
    cur_users = (await db.scalar(cur_users_stmt)) or 0

    prev_users_stmt = select(func.count(User.id)).where(
        and_(User.created_at >= prev_start, User.created_at < cur_start)
    )
    prev_users = (await db.scalar(prev_users_stmt)) or 0

    # Seller mới
    cur_sellers_stmt = select(func.count(SellerProfile.id)).where(
        and_(
            SellerProfile.status == "APPROVED",
            SellerProfile.created_at >= cur_start,
            SellerProfile.created_at <= cur_end,
        )
    )
    cur_sellers = (await db.scalar(cur_sellers_stmt)) or 0

    prev_sellers_stmt = select(func.count(SellerProfile.id)).where(
        and_(
            SellerProfile.status == "APPROVED",
            SellerProfile.created_at >= prev_start,
            SellerProfile.created_at < cur_start,
        )
    )
    prev_sellers = (await db.scalar(prev_sellers_stmt)) or 0

    # Tổng sản phẩm
    total_products = (
        await db.scalar(select(func.count(Product.id)).where(Product.status != "DELETED"))
    ) or 0
    prev_products = (
        await db.scalar(
            select(func.count(Product.id)).where(
                and_(Product.status != "DELETED", Product.created_at < cur_start)
            )
        )
    ) or 0

    hero_kpis = AdminHeroKpisResponse(
        revenue=AdminKpiDelta(
            current_value=cur_rev,
            previous_value=prev_rev,
            delta_pct=compute_delta_pct(cur_rev, prev_rev),
        ),
        orders=AdminKpiDelta(
            current_value=cur_orders,
            previous_value=prev_orders,
            delta_pct=compute_delta_pct(cur_orders, prev_orders),
        ),
        new_users=AdminKpiDelta(
            current_value=cur_users,
            previous_value=prev_users,
            delta_pct=compute_delta_pct(cur_users, prev_users),
        ),
        new_sellers=AdminKpiDelta(
            current_value=cur_sellers,
            previous_value=prev_sellers,
            delta_pct=compute_delta_pct(cur_sellers, prev_sellers),
        ),
        products=AdminKpiDelta(
            current_value=total_products,
            previous_value=prev_products,
            delta_pct=compute_delta_pct(total_products, prev_products),
        ),
    )

    # ==========================================
    # 2. MICRO KPIS (100% từ CSDL)
    # ==========================================
    # Hoàn đơn
    cur_returns = (
        await db.scalar(
            select(func.count(OrderReturn.id)).where(
                and_(OrderReturn.created_at >= cur_start, OrderReturn.created_at <= cur_end)
            )
        )
    ) or 0
    prev_returns = (
        await db.scalar(
            select(func.count(OrderReturn.id)).where(
                and_(OrderReturn.created_at >= prev_start, OrderReturn.created_at < cur_start)
            )
        )
    ) or 0

    cur_return_rate = round((cur_returns / cur_orders * 100), 2) if cur_orders > 0 else 0.0
    prev_return_rate = round((prev_returns / prev_orders * 100), 2) if prev_orders > 0 else 0.0

    # AOV
    cur_completed_cnt = (
        await db.scalar(
            select(func.count(Order.id)).where(
                and_(
                    Order.order_status == "COMPLETED",
                    Order.completed_at >= cur_start,
                    Order.completed_at <= cur_end,
                )
            )
        )
    ) or 0
    cur_aov = round(cur_rev / cur_completed_cnt, 0) if cur_completed_cnt > 0 else Decimal("0")

    prev_completed_cnt = (
        await db.scalar(
            select(func.count(Order.id)).where(
                and_(
                    Order.order_status == "COMPLETED",
                    Order.completed_at >= prev_start,
                    Order.completed_at < cur_start,
                )
            )
        )
    ) or 0
    prev_aov = round(prev_rev / prev_completed_cnt, 0) if prev_completed_cnt > 0 else Decimal("0")

    # Lượt truy cập từ bảng traffic_logs thực tế
    cur_traffic_count = (
        await db.scalar(
            select(func.count(TrafficLog.id)).where(
                and_(TrafficLog.created_at >= cur_start, TrafficLog.created_at <= cur_end)
            )
        )
    ) or 0
    prev_traffic_count = (
        await db.scalar(
            select(func.count(TrafficLog.id)).where(
                and_(TrafficLog.created_at >= prev_start, TrafficLog.created_at < cur_start)
            )
        )
    ) or 0

    # Conversion Rate thực tế
    cur_cvr = round((cur_orders / cur_traffic_count * 100), 2) if cur_traffic_count > 0 else 0.0
    prev_cvr = round((prev_orders / prev_traffic_count * 100), 2) if prev_traffic_count > 0 else 0.0

    # Đánh giá (Reviews)
    cur_reviews = (
        await db.scalar(
            select(func.count(ProductReview.id)).where(
                and_(ProductReview.created_at >= cur_start, ProductReview.created_at <= cur_end)
            )
        )
    ) or 0
    prev_reviews = (
        await db.scalar(
            select(func.count(ProductReview.id)).where(
                and_(ProductReview.created_at >= prev_start, ProductReview.created_at < cur_start)
            )
        )
    ) or 0

    micro_kpis = AdminMicroKpisResponse(
        return_rate=AdminKpiDelta(
            current_value=cur_return_rate,
            previous_value=prev_return_rate,
            delta_pct=compute_delta_pct(cur_return_rate, prev_return_rate),
        ),
        aov=AdminKpiDelta(
            current_value=cur_aov,
            previous_value=prev_aov,
            delta_pct=compute_delta_pct(cur_aov, prev_aov),
        ),
        total_visits=AdminKpiDelta(
            current_value=cur_traffic_count,
            previous_value=prev_traffic_count,
            delta_pct=compute_delta_pct(cur_traffic_count, prev_traffic_count),
        ),
        conversion_rate=AdminKpiDelta(
            current_value=cur_cvr,
            previous_value=prev_cvr,
            delta_pct=compute_delta_pct(cur_cvr, prev_cvr),
        ),
        total_reviews=AdminKpiDelta(
            current_value=cur_reviews,
            previous_value=prev_reviews,
            delta_pct=compute_delta_pct(cur_reviews, prev_reviews),
        ),
    )

    # ==========================================
    # 3. REVENUE AREA SERIES (100% từ CSDL)
    # ==========================================
    revenue_chart: List[AdminRevenueSeriesPoint] = []
    if point_type == "HOURLY":
        cur_day = cur_start.date()
        prev_day = prev_start.date()
        for h in range(24):
            h_cur_start = datetime.combine(cur_day, time(hour=h, minute=0, second=0))
            h_cur_end = datetime.combine(cur_day, time(hour=h, minute=59, second=59, microsecond=999999))

            h_prev_start = datetime.combine(prev_day, time(hour=h, minute=0, second=0))
            h_prev_end = datetime.combine(prev_day, time(hour=h, minute=59, second=59, microsecond=999999))

            # Kỳ hiện tại (hôm nay)
            rev_c = Decimal("0")
            ord_c = 0
            if h_cur_start <= now:
                rev_c = (
                    await db.scalar(
                        select(func.coalesce(func.sum(Order.total_amount), Decimal("0"))).where(
                            and_(
                                Order.order_status == "COMPLETED",
                                Order.completed_at >= h_cur_start,
                                Order.completed_at <= h_cur_end,
                            )
                        )
                    )
                ) or Decimal("0")
                ord_c = (
                    await db.scalar(
                        select(func.count(Order.id)).where(
                            and_(Order.created_at >= h_cur_start, Order.created_at <= h_cur_end)
                        )
                    )
                ) or 0

            # Kỳ trước (cùng giờ ngày hôm qua)
            rev_p = (
                await db.scalar(
                    select(func.coalesce(func.sum(Order.total_amount), Decimal("0"))).where(
                        and_(
                            Order.order_status == "COMPLETED",
                            Order.completed_at >= h_prev_start,
                            Order.completed_at <= h_prev_end,
                        )
                    )
                )
            ) or Decimal("0")
            ord_p = (
                await db.scalar(
                    select(func.count(Order.id)).where(
                        and_(Order.created_at >= h_prev_start, Order.created_at <= h_prev_end)
                    )
                )
            ) or 0

            revenue_chart.append(
                AdminRevenueSeriesPoint(
                    label=f"{h:02d}:00",
                    full_date=h_cur_start.isoformat(),
                    current_revenue=rev_c,
                    previous_revenue=rev_p,
                    current_orders=ord_c,
                    previous_orders=ord_p,
                )
            )
    elif point_type == "DAILY":
        days_span = max(1, (cur_end - cur_start).days)
        for i in range(days_span):
            d_cur = (cur_start + timedelta(days=i)).date()
            d_prev = (prev_start + timedelta(days=i)).date()

            # Kỳ hiện tại
            d_cur_start = datetime.combine(d_cur, datetime.min.time())
            d_cur_end = datetime.combine(d_cur, datetime.max.time())
            rev_c = (
                await db.scalar(
                    select(func.coalesce(func.sum(Order.total_amount), Decimal("0"))).where(
                        and_(
                            Order.order_status == "COMPLETED",
                            Order.completed_at >= d_cur_start,
                            Order.completed_at <= d_cur_end,
                        )
                    )
                )
            ) or Decimal("0")
            ord_c = (
                await db.scalar(
                    select(func.count(Order.id)).where(
                        and_(Order.created_at >= d_cur_start, Order.created_at <= d_cur_end)
                    )
                )
            ) or 0

            # Kỳ trước
            d_prev_start = datetime.combine(d_prev, datetime.min.time())
            d_prev_end = datetime.combine(d_prev, datetime.max.time())
            rev_p = (
                await db.scalar(
                    select(func.coalesce(func.sum(Order.total_amount), Decimal("0"))).where(
                        and_(
                            Order.order_status == "COMPLETED",
                            Order.completed_at >= d_prev_start,
                            Order.completed_at <= d_prev_end,
                        )
                    )
                )
            ) or Decimal("0")
            ord_p = (
                await db.scalar(
                    select(func.count(Order.id)).where(
                        and_(Order.created_at >= d_prev_start, Order.created_at <= d_prev_end)
                    )
                )
            ) or 0

            revenue_chart.append(
                AdminRevenueSeriesPoint(
                    label=d_cur.strftime("%d/%m"),
                    full_date=d_cur.isoformat(),
                    current_revenue=rev_c,
                    previous_revenue=rev_p,
                    current_orders=ord_c,
                    previous_orders=ord_p,
                )
            )
    elif point_type == "MONTHLY":
        if time_preset == "12MONTHS":
            # 12 tháng gần nhất
            months_list = []
            for i in range(11, -1, -1):
                y = now.year
                m = now.month - i
                while m <= 0:
                    m += 12
                    y -= 1
                months_list.append((y, m))
        else:
            # Tất cả các tháng từ cur_start đến cur_end
            months_list = []
            cur_y, cur_m = cur_start.year, cur_start.month
            end_y, end_m = cur_end.year, cur_end.month
            while (cur_y < end_y) or (cur_y == end_y and cur_m <= end_m):
                months_list.append((cur_y, cur_m))
                cur_m += 1
                if cur_m > 12:
                    cur_m = 1
                    cur_y += 1

        for y, m in months_list:
            m_start = datetime(y, m, 1)
            m_end = datetime(y + 1, 1, 1) if m == 12 else datetime(y, m + 1, 1)
            prev_m_start = datetime(y - 1, m, 1)
            prev_m_end = datetime(y, 1, 1) if m == 12 else datetime(y - 1, m + 1, 1)

            rev_c = (
                await db.scalar(
                    select(func.coalesce(func.sum(Order.total_amount), Decimal("0"))).where(
                        and_(
                            Order.order_status == "COMPLETED",
                            Order.completed_at >= m_start,
                            Order.completed_at < m_end,
                        )
                    )
                )
            ) or Decimal("0")
            ord_c = (
                await db.scalar(
                    select(func.count(Order.id)).where(
                        and_(Order.created_at >= m_start, Order.created_at < m_end)
                    )
                )
            ) or 0

            # Nếu chọn 'ALL', không hiển thị so sánh kỳ trước bị 0 do năm cũ
            if time_preset == "ALL":
                rev_p = Decimal("0")
                ord_p = 0
            else:
                rev_p = (
                    await db.scalar(
                        select(func.coalesce(func.sum(Order.total_amount), Decimal("0"))).where(
                            and_(
                                Order.order_status == "COMPLETED",
                                Order.completed_at >= prev_m_start,
                                Order.completed_at < prev_m_end,
                            )
                        )
                    )
                ) or Decimal("0")
                ord_p = (
                    await db.scalar(
                        select(func.count(Order.id)).where(
                            and_(Order.created_at >= prev_m_start, Order.created_at < prev_m_end)
                        )
                    )
                ) or 0

            revenue_chart.append(
                AdminRevenueSeriesPoint(
                    label=f"{m:02d}/{y % 100:02d}",
                    full_date=f"{y:04d}-{m:02d}-01",
                    current_revenue=rev_c,
                    previous_revenue=rev_p,
                    current_orders=ord_c,
                    previous_orders=ord_p,
                )
            )
    elif point_type == "QUARTERLY":
        # Gom nhóm theo Quý (Quarterly)
        start_q = (cur_start.month - 1) // 3 + 1
        end_q = (cur_end.month - 1) // 3 + 1
        quarters_list = []
        cur_y, cur_q = cur_start.year, start_q
        end_y = cur_end.year
        while (cur_y < end_y) or (cur_y == end_y and cur_q <= end_q):
            quarters_list.append((cur_y, cur_q))
            cur_q += 1
            if cur_q > 4:
                cur_q = 1
                cur_y += 1

        for y, q in quarters_list:
            q_start_m = (q - 1) * 3 + 1
            q_end_m = q * 3
            q_start = datetime(y, q_start_m, 1)
            q_end = datetime(y + 1, 1, 1) if q == 4 else datetime(y, q_end_m + 1, 1)

            rev_c = (
                await db.scalar(
                    select(func.coalesce(func.sum(Order.total_amount), Decimal("0"))).where(
                        and_(
                            Order.order_status == "COMPLETED",
                            Order.completed_at >= q_start,
                            Order.completed_at < q_end,
                        )
                    )
                )
            ) or Decimal("0")
            ord_c = (
                await db.scalar(
                    select(func.count(Order.id)).where(
                        and_(Order.created_at >= q_start, Order.created_at < q_end)
                    )
                )
            ) or 0

            revenue_chart.append(
                AdminRevenueSeriesPoint(
                    label=f"Q{q}/{y % 100:02d}",
                    full_date=f"{y:04d}-{q_start_m:02d}-01",
                    current_revenue=rev_c,
                    previous_revenue=Decimal("0"),
                    current_orders=ord_c,
                    previous_orders=0,
                )
            )
    else:  # YEARLY
        years_list = list(range(cur_start.year, cur_end.year + 1))
        for y in years_list:
            y_start = datetime(y, 1, 1)
            y_end = datetime(y + 1, 1, 1)

            rev_c = (
                await db.scalar(
                    select(func.coalesce(func.sum(Order.total_amount), Decimal("0"))).where(
                        and_(
                            Order.order_status == "COMPLETED",
                            Order.completed_at >= y_start,
                            Order.completed_at < y_end,
                        )
                    )
                )
            ) or Decimal("0")
            ord_c = (
                await db.scalar(
                    select(func.count(Order.id)).where(
                        and_(Order.created_at >= y_start, Order.created_at < y_end)
                    )
                )
            ) or 0

            revenue_chart.append(
                AdminRevenueSeriesPoint(
                    label=f"{y}",
                    full_date=f"{y:04d}-01-01",
                    current_revenue=rev_c,
                    previous_revenue=Decimal("0"),
                    current_orders=ord_c,
                    previous_orders=0,
                )
            )

    # ==========================================
    # 4. ORDER STATUS DONUT (100% từ CSDL)
    # ==========================================
    status_counts_res = await db.execute(
        select(Order.order_status, func.count(Order.id))
        .where(and_(Order.created_at >= cur_start, Order.created_at <= cur_end))
        .group_by(Order.order_status)
    )
    status_map = {row[0]: row[1] for row in status_counts_res.all()}
    total_ord_period = sum(status_map.values()) or 0

    status_config = [
        ("CONFIRMED", "Đã xác nhận", status_map.get("PLACED", 0) + status_map.get("READY_TO_SHIP", 0), "#f59e0b"),
        ("SHIPPING", "Đang giao", status_map.get("SHIPPING", 0), "#3b82f6"),
        ("DELIVERED", "Đã giao", status_map.get("COMPLETED", 0) + status_map.get("DELIVERED", 0), "#10b981"),
        ("CANCELLED", "Đã hủy", status_map.get("CANCELLED", 0), "#ef4444"),
        ("RETURNED", "Hoàn/Trả", status_map.get("RETURNED", 0) + status_map.get("DELIVERY_FAILED", 0), "#8b5cf6"),
    ]

    order_status_donut = [
        AdminOrderStatusDonutItem(
            status=cfg[0],
            label=cfg[1],
            count=cfg[2],
            percentage=round((cfg[2] / total_ord_period) * 100, 1) if total_ord_period > 0 else 0.0,
            color=cfg[3],
        )
        for cfg in status_config
    ]

    # ==========================================
    # 5. USER GROWTH CHART (100% từ CSDL)
    # ==========================================
    user_growth_chart: List[AdminUserGrowthSeriesPoint] = []
    for pt in revenue_chart:
        try:
            if point_type == "YEARLY":
                pt_date = datetime.fromisoformat(pt.full_date).date()
                pt_start = datetime(pt_date.year, 1, 1)
                pt_end = datetime(pt_date.year + 1, 1, 1)
            elif point_type == "QUARTERLY":
                pt_date = datetime.fromisoformat(pt.full_date).date()
                q_m = pt_date.month
                pt_start = datetime(pt_date.year, q_m, 1)
                pt_end = datetime(pt_date.year + 1, 1, 1) if q_m == 10 else datetime(pt_date.year, q_m + 3, 1)
            elif point_type == "MONTHLY":
                pt_date = datetime.fromisoformat(pt.full_date).date()
                pt_start = datetime(pt_date.year, pt_date.month, 1)
                pt_end = datetime(pt_date.year + 1, 1, 1) if pt_date.month == 12 else datetime(pt_date.year, pt_date.month + 1, 1)
            elif point_type == "HOURLY":
                pt_start = datetime.fromisoformat(pt.full_date)
                pt_end = pt_start + timedelta(hours=1)
            else:  # DAILY
                pt_date = datetime.fromisoformat(pt.full_date).date()
                pt_start = datetime.combine(pt_date, datetime.min.time())
                pt_end = datetime.combine(pt_date, datetime.max.time())

            n_users = (
                await db.scalar(
                    select(func.count(User.id)).where(
                        and_(
                            User.created_at >= pt_start,
                            User.created_at < pt_end if point_type in ["HOURLY", "MONTHLY", "QUARTERLY", "YEARLY"] else User.created_at <= pt_end,
                        )
                    )
                )
            ) or 0
            act_users = (
                await db.scalar(
                    select(func.count(distinct(Order.user_id))).where(
                        and_(
                            Order.created_at >= pt_start,
                            Order.created_at < pt_end if point_type in ["HOURLY", "MONTHLY", "QUARTERLY", "YEARLY"] else Order.created_at <= pt_end,
                        )
                    )
                )
            ) or 0
        except Exception:
            n_users = 0
            act_users = 0

        user_growth_chart.append(
            AdminUserGrowthSeriesPoint(
                label=pt.label,
                new_users=n_users,
                active_users=act_users,
            )
        )

    # ==========================================
    # 6. TRAFFIC SOURCES DONUT (100% từ CSDL)
    # ==========================================
    traffic_src_res = await db.execute(
        select(TrafficLog.source_channel, func.count(TrafficLog.id))
        .where(and_(TrafficLog.created_at >= cur_start, TrafficLog.created_at <= cur_end))
        .group_by(TrafficLog.source_channel)
    )
    raw_traffic_map = {row[0]: row[1] for row in traffic_src_res.all()}
    total_raw_traffic = sum(raw_traffic_map.values())

    channel_meta = [
        ("DIRECT", "Trực tiếp", "#10b981"),
        ("ORGANIC_SEARCH", "Tìm kiếm tự nhiên", "#3b82f6"),
        ("SOCIAL", "Mạng xã hội", "#8b5cf6"),
        ("REFERRAL", "Giới thiệu", "#f59e0b"),
        ("ADS", "Quảng cáo", "#ec4899"),
    ]

    traffic_sources = [
        AdminTrafficSourceItem(
            channel=ch,
            label=lbl,
            count=raw_traffic_map.get(ch, 0),
            percentage=round((raw_traffic_map.get(ch, 0) / total_raw_traffic) * 100, 1) if total_raw_traffic > 0 else 0.0,
            color=clr,
        )
        for ch, lbl, clr in channel_meta
    ]

    # ==========================================
    # 6.1 PAYMENT & FINANCE BREAKDOWN (100% từ CSDL)
    # ==========================================
    payment_stmt = (
        select(
            func.coalesce(Order.preferred_payment_method, "COD").label("pm"),
            func.coalesce(func.sum(Order.total_amount), Decimal("0")),
            func.count(Order.id),
        )
        .where(
            and_(
                Order.order_status == "COMPLETED",
                Order.completed_at >= cur_start,
                Order.completed_at <= cur_end,
            )
        )
        .group_by(func.coalesce(Order.preferred_payment_method, "COD"))
    )
    payment_res = await db.execute(payment_stmt)
    raw_pay_map: Dict[str, Tuple[Decimal, int]] = {}
    for row in payment_res.all():
        pm_str = str(row[0] or "COD").upper()
        if "VNPAY" in pm_str or "BANK" in pm_str or "ONLINE" in pm_str:
            k = "VNPAY"
        elif "WALLET" in pm_str:
            k = "WALLET"
        else:
            k = "COD"
        prev_rev, prev_cnt = raw_pay_map.get(k, (Decimal("0"), 0))
        raw_pay_map[k] = (prev_rev + Decimal(str(row[1])), prev_cnt + int(row[2]))

    total_pay_rev = sum([v[0] for v in raw_pay_map.values()], Decimal("0"))

    pay_channels_meta = [
        ("VNPAY", "VNPay / Trực tuyến", "#3b82f6"),
        ("COD", "COD / Khi nhận hàng", "#10b981"),
        ("WALLET", "Ví số dư sàn", "#8b5cf6"),
    ]

    payment_breakdown = [
        AdminPaymentDonutItem(
            channel=ch,
            label=lbl,
            revenue=raw_pay_map.get(ch, (Decimal("0"), 0))[0],
            count=raw_pay_map.get(ch, (Decimal("0"), 0))[1],
            percentage=round(float(raw_pay_map.get(ch, (Decimal("0"), 0))[0] / total_pay_rev) * 100, 1) if total_pay_rev > 0 else 0.0,
            color=clr,
        )
        for ch, lbl, clr in pay_channels_meta
    ]

    # ==========================================
    # 6.2 DÒNG TIỀN TÀI CHÍNH THEO KỲ LỌC (100% Khớp tổng tiền vào sàn)
    # ==========================================
    finance_overview: Optional[AdminPlatformFinanceOverview] = None
    try:
        # 1. Đơn hoàn tất trong kỳ: Tiền hàng & Phí ship
        comp_orders_stmt = (
            select(
                func.coalesce(func.sum(Order.subtotal_amount), Decimal("0")),
                func.coalesce(func.sum(Order.shipping_fee), Decimal("0")),
            )
            .where(
                and_(
                    Order.order_status == "COMPLETED",
                    Order.completed_at >= cur_start,
                    Order.completed_at <= cur_end,
                )
            )
        )
        comp_orders_res = (await db.execute(comp_orders_stmt)).one()
        gross_prod_in_period = Decimal(str(comp_orders_res[0]))
        shipping_in_period = Decimal(str(comp_orders_res[1]))

        # Phí sàn: 2% thanh toán + 3% hoa hồng = 5% trên tiền hàng
        platform_rev_in_period = gross_prod_in_period * Decimal("0.05")
        seller_net_in_period = gross_prod_in_period - platform_rev_in_period

        # 2. Tiền hoàn lại cho khách trong kỳ (Refunds hoặc đơn hủy đã thanh toán):
        refund_stmt = (
            select(func.coalesce(func.sum(Refund.amount), Decimal("0")))
            .where(
                and_(
                    Refund.refund_status == "SUCCESS",
                    Refund.created_at >= cur_start,
                    Refund.created_at <= cur_end,
                )
            )
        )
        refund_sum = (await db.execute(refund_stmt)).scalar() or Decimal("0")

        cancelled_paid_stmt = (
            select(func.coalesce(func.sum(Order.total_amount), Decimal("0")))
            .where(
                and_(
                    Order.order_status.in_(["CANCELLED", "RETURNED"]),
                    Order.payment_status.in_(["PAID", "REFUNDED"]),
                    Order.updated_at >= cur_start,
                    Order.updated_at <= cur_end,
                )
            )
        )
        cancelled_paid_sum = (await db.execute(cancelled_paid_stmt)).scalar() or Decimal("0")
        refund_in_period = max(Decimal(str(refund_sum)), Decimal(str(cancelled_paid_sum)))

        # 3. Tổng tiền vào sàn = Tiền ví Shop + Doanh thu sàn + Cước vận chuyển + Tiền hoàn khách
        total_inflow = seller_net_in_period + platform_rev_in_period + shipping_in_period + refund_in_period
        safe_inflow = float(total_inflow) if total_inflow > Decimal("0") else 1.0

        seller_amt = float(seller_net_in_period)
        plat_amt = float(platform_rev_in_period)
        ship_amt = float(shipping_in_period)
        ref_amt = float(refund_in_period)

        chart_items = [
            AdminFinanceDonutItem(
                key="seller_wallets",
                label="Tiền ví Shop",
                amount=seller_amt,
                percentage=round((seller_amt / safe_inflow) * 100, 1) if total_inflow > 0 else 0.0,
                color="#10b981", # Xanh lá
            ),
            AdminFinanceDonutItem(
                key="platform_revenue",
                label="Doanh thu sàn",
                amount=plat_amt,
                percentage=round((plat_amt / safe_inflow) * 100, 1) if total_inflow > 0 else 0.0,
                color="#f59e0b", # Vàng cam
            ),
            AdminFinanceDonutItem(
                key="shipping",
                label="Tiền chuyển ship",
                amount=ship_amt,
                percentage=round((ship_amt / safe_inflow) * 100, 1) if total_inflow > 0 else 0.0,
                color="#0284c7", # Xanh sky
            ),
            AdminFinanceDonutItem(
                key="refund",
                label="Hoàn lại khách",
                amount=ref_amt,
                percentage=round((ref_amt / safe_inflow) * 100, 1) if total_inflow > 0 else 0.0,
                color="#ef4444", # Đỏ hồng
            ),
        ]

        finance_overview = AdminPlatformFinanceOverview(
            total_held_liquidity=float(total_inflow),
            total_cash_inflow=float(total_inflow),
            total_cash_outflow=ref_amt,
            escrow_holding=ref_amt,
            shipping_held=ship_amt,
            seller_wallets=seller_amt,
            platform_revenue=plat_amt,
            payouts_disbursed=ref_amt,
            chart_items=chart_items,
        )
    except Exception:
        finance_overview = AdminPlatformFinanceOverview()

    # ==========================================
    # 7. TOP CATEGORIES (100% từ CSDL)
    # ==========================================
    cat_stmt = (
        select(
            Category.id,
            Category.name,
            func.coalesce(func.sum(OrderItem.subtotal), Decimal("0")).label("cat_rev"),
        )
        .join(ProductCategory, ProductCategory.category_id == Category.id)
        .join(Product, Product.id == ProductCategory.product_id)
        .join(OrderItem, OrderItem.product_id == Product.id)
        .join(
            Order,
            and_(
                OrderItem.order_id == Order.id,
                Order.order_status == "COMPLETED",
                Order.completed_at >= cur_start,
                Order.completed_at <= cur_end,
            ),
        )
        .group_by(Category.id, Category.name)
        .order_by(func.coalesce(func.sum(OrderItem.subtotal), Decimal("0")).desc())
        .limit(6)
    )
    cat_res = await db.execute(cat_stmt)
    cat_rows = cat_res.all()

    # Tổng doanh thu danh mục toàn sàn trong kỳ để tính tỷ trọng chính xác (%)
    total_all_cat_rev = (
        await db.scalar(
            select(func.coalesce(func.sum(OrderItem.subtotal), Decimal("0")))
            .join(
                Order,
                and_(
                    OrderItem.order_id == Order.id,
                    Order.order_status == "COMPLETED",
                    Order.completed_at >= cur_start,
                    Order.completed_at <= cur_end,
                ),
            )
        )
    ) or Decimal("0")

    top_categories = [
        AdminTopCategory(
            rank=idx + 1,
            id=str(row[0]),
            name=row[1],
            revenue=row[2],
            percentage=round(float(row[2] / total_all_cat_rev) * 100, 1) if total_all_cat_rev > 0 else 0.0,
        )
        for idx, row in enumerate(cat_rows)
    ]

    # ==========================================
    # 8. TOP SELLERS (100% từ CSDL)
    # ==========================================
    seller_stmt = (
        select(
            SellerProfile.id,
            SellerProfile.public_id,
            SellerProfile.shop_name,
            SellerProfile.shop_logo_url,
            func.coalesce(func.sum(Order.total_amount), Decimal("0")),
            func.count(distinct(Order.id)),
        )
        .outerjoin(
            Order,
            and_(
                Order.seller_id == SellerProfile.id,
                Order.order_status == "COMPLETED",
                Order.completed_at >= cur_start,
                Order.completed_at <= cur_end,
            ),
        )
        .where(SellerProfile.status == "APPROVED")
        .group_by(
            SellerProfile.id,
            SellerProfile.public_id,
            SellerProfile.shop_name,
            SellerProfile.shop_logo_url,
        )
        .order_by(func.coalesce(func.sum(Order.total_amount), Decimal("0")).desc())
        .limit(5)
    )
    seller_res = await db.execute(seller_stmt)
    top_sellers: List[AdminTopSellerDetailed] = []
    for idx, (s_pk, s_pub, s_name, s_logo, s_rev, s_orders) in enumerate(seller_res.all()):
        # Query rating thực tế từ các sản phẩm của shop (ưu tiên sản phẩm đã có review)
        shop_rating_stmt = select(func.coalesce(func.avg(Product.average_rating), Decimal("0"))).where(
            and_(
                Product.seller_id == s_pk,
                Product.status != "DELETED",
                Product.review_count > 0,
            )
        )
        avg_r = await db.scalar(shop_rating_stmt)
        if avg_r is None or avg_r == 0:
            shop_rating_fallback = select(func.coalesce(func.avg(Product.average_rating), Decimal("0"))).where(
                and_(Product.seller_id == s_pk, Product.status != "DELETED")
            )
            avg_r = (await db.scalar(shop_rating_fallback)) or Decimal("0")

        top_sellers.append(
            AdminTopSellerDetailed(
                rank=idx + 1,
                id=s_pub,
                name=s_name,
                logo_url=s_logo,
                revenue=s_rev,
                products_count=s_orders,
                rating=float(round(avg_r, 1)),
            )
        )

    # ==========================================
    # 9. DEMOGRAPHICS (100% từ CSDL)
    # ==========================================
    # Devices từ traffic_logs
    device_stmt = select(TrafficLog.device_type, func.count(TrafficLog.id)).group_by(TrafficLog.device_type)
    device_res = await db.execute(device_stmt)
    device_map = {row[0]: row[1] for row in device_res.all()}
    total_devs = sum(device_map.values()) or 0

    # Gender từ users
    gender_stmt = select(User.gender, func.count(User.id)).group_by(User.gender)
    gender_res = await db.execute(gender_stmt)
    gender_map = {row[0]: row[1] for row in gender_res.all()}
    total_genders = sum(gender_map.values()) or 0
    male_cnt = gender_map.get("MALE", 0)
    female_cnt = gender_map.get("FEMALE", 0)
    other_cnt = gender_map.get("OTHER", 0) + gender_map.get(None, 0)

    # Age groups từ date_of_birth của users
    dob_users = (await db.scalars(select(User.date_of_birth).where(User.date_of_birth.isnot(None)))).all()
    age_bins = {"<18": 0, "18-24": 0, "25-34": 0, "35-44": 0, "45-54": 0, "55+": 0}
    today_dt = date.today()
    for dob in dob_users:
        age = today_dt.year - dob.year - ((today_dt.month, today_dt.day) < (dob.month, dob.day))
        if age < 18:
            age_bins["<18"] += 1
        elif age <= 24:
            age_bins["18-24"] += 1
        elif age <= 34:
            age_bins["25-34"] += 1
        elif age <= 34:
            age_bins["35-44"] += 1
        elif age <= 54:
            age_bins["45-54"] += 1
        else:
            age_bins["55+"] += 1

    total_dob = len(dob_users)
    age_groups_list = [
        {
            "group": k,
            "count": v,
            "percentage": round((v / total_dob) * 100, 1) if total_dob > 0 else 0.0,
        }
        for k, v in age_bins.items()
    ]

    demographics = AdminDemographicsResponse(
        devices={
            "mobile": round((device_map.get("MOBILE", 0) / total_devs) * 100, 1) if total_devs > 0 else 0.0,
            "desktop": round((device_map.get("DESKTOP", 0) / total_devs) * 100, 1) if total_devs > 0 else 0.0,
            "tablet": round((device_map.get("TABLET", 0) / total_devs) * 100, 1) if total_devs > 0 else 0.0,
            "mobile_count": device_map.get("MOBILE", 0),
            "desktop_count": device_map.get("DESKTOP", 0),
            "tablet_count": device_map.get("TABLET", 0),
            "total_count": total_devs,
        },
        age_groups=age_groups_list,
        gender={
            "male": round((male_cnt / total_genders) * 100, 1) if total_genders > 0 else 0.0,
            "female": round((female_cnt / total_genders) * 100, 1) if total_genders > 0 else 0.0,
            "other": round((other_cnt / total_genders) * 100, 1) if total_genders > 0 else 0.0,
            "male_count": male_cnt,
            "female_count": female_cnt,
            "other_count": other_cnt,
            "total_count": total_genders,
        },
    )

    # ==========================================
    # 10. TOP PRODUCTS (100% từ CSDL theo kỳ lọc)
    # ==========================================
    top_p_stmt = (
        select(
            Product.id,
            Product.public_id,
            Product.name,
            func.coalesce(func.sum(OrderItem.quantity), 0).label("period_sold"),
            func.coalesce(func.sum(OrderItem.subtotal), Decimal("0")).label("period_rev"),
            SellerProfile.shop_name,
        )
        .join(OrderItem, OrderItem.product_id == Product.id)
        .join(
            Order,
            and_(
                OrderItem.order_id == Order.id,
                Order.order_status == "COMPLETED",
                Order.completed_at >= cur_start,
                Order.completed_at <= cur_end,
            ),
        )
        .outerjoin(SellerProfile, Product.seller_id == SellerProfile.id)
        .where(Product.status != "DELETED")
        .group_by(
            Product.id,
            Product.public_id,
            Product.name,
            SellerProfile.shop_name,
        )
        .order_by(func.coalesce(func.sum(OrderItem.quantity), 0).desc())
        .limit(5)
    )
    top_p_res = await db.execute(top_p_stmt)
    top_p_rows = top_p_res.all()

    # Lấy nhanh thumbnail image cho các sản phẩm trong top (batch query tránh N+1)
    product_ids = [row[0] for row in top_p_rows]
    image_map: Dict[int, str] = {}
    if product_ids:
        imgs_stmt = (
            select(ProductImage.product_id, ProductImage.image_url)
            .where(ProductImage.product_id.in_(product_ids))
            .order_by(ProductImage.is_thumbnail.desc())
        )
        imgs_res = await db.execute(imgs_stmt)
        for p_id, img_u in imgs_res.all():
            if p_id not in image_map:
                image_map[p_id] = img_u

    top_products: List[AdminTopProductDetailed] = [
        AdminTopProductDetailed(
            rank=idx + 1,
            id=row[1],
            name=row[2],
            image_url=image_map.get(row[0]),
            seller_name=row[5] or "Gian hàng",
            sold_count=int(row[3] or 0),
            revenue=row[4],
        )
        for idx, row in enumerate(top_p_rows)
    ]

    # ==========================================
    # 11. SYSTEM ALERTS (100% từ sự kiện có thật)
    # ==========================================
    action_counts = await get_action_counts(db)
    system_alerts: List[AdminSystemAlertItem] = []

    if action_counts.failed_payment_orders > 0:
        system_alerts.append(
            AdminSystemAlertItem(
                id="alert-payment-failed",
                type="danger",
                title=f"Có {action_counts.failed_payment_orders} đơn hàng thanh toán/giao thất bại",
                description="Vui lòng kiểm tra và xử lý đối soát cổng thanh toán hoặc vận chuyển.",
                time_ago="Cần xử lý",
                action_url="/admin/orders",
            )
        )

    if action_counts.pending_seller_applications > 0:
        system_alerts.append(
            AdminSystemAlertItem(
                id="alert-seller-pending",
                type="warning",
                title=f"Yêu cầu xác minh từ {action_counts.pending_seller_applications} người bán mới",
                description="Vui lòng xem xét và phê duyệt hồ sơ đăng ký gian hàng.",
                time_ago="Cần xử lý",
                action_url="/admin/sellers?status=PENDING",
            )
        )

    if action_counts.pending_violation_reports > 0:
        system_alerts.append(
            AdminSystemAlertItem(
                id="alert-violation-pending",
                type="warning",
                title=f"Có {action_counts.pending_violation_reports} báo cáo vi phạm mới",
                description="Cần kiểm duyệt nội dung vi phạm tiêu chuẩn cộng đồng.",
                time_ago="Cần xử lý",
                action_url="/admin/violation-reports?status=PENDING",
            )
        )

    if action_counts.pending_category_suggestions > 0:
        system_alerts.append(
            AdminSystemAlertItem(
                id="alert-category-pending",
                type="info",
                title=f"Có {action_counts.pending_category_suggestions} đề xuất danh mục mới",
                description="Người bán gửi yêu cầu bổ sung ngành hàng mới.",
                time_ago="Cần xử lý",
                action_url="/admin/categories",
            )
        )

    # ==========================================
    # 12. HOURLY HEATMAP (100% từ TrafficLog theo giờ GMT+7)
    # ==========================================
    day_labels = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"]
    heatmap_cells: List[AdminHourlyHeatmapCell] = []
    
    # Chuyển đổi timestamp sang giờ Việt Nam (UTC+7)
    vn_time = func.date_add(TrafficLog.created_at, text("INTERVAL 7 HOUR"))
    heatmap_stmt = select(
        func.dayofweek(vn_time).label("dow"),
        func.hour(vn_time).label("hr"),
        func.count(TrafficLog.id).label("cnt"),
    ).group_by(func.dayofweek(vn_time), func.hour(vn_time))

    heatmap_res = await db.execute(heatmap_stmt)
    heatmap_dict: Dict[Tuple[int, int], int] = {}
    max_cell_count = 1

    for dow, hr, cnt in heatmap_res.all():
        mapped_dow = 6 if dow == 1 else (dow - 2)
        heatmap_dict[(mapped_dow, int(hr))] = cnt
        if cnt > max_cell_count:
            max_cell_count = cnt

    for d in range(7):
        for h in range(24):
            count = heatmap_dict.get((d, h), 0)
            intensity = min(100, int((count / max_cell_count) * 100)) if max_cell_count > 0 else 0
            heatmap_cells.append(
                AdminHourlyHeatmapCell(
                    day_of_week=d,
                    day_label=day_labels[d],
                    hour=h,
                    intensity=intensity,
                    count=count,
                )
            )

    # ==========================================
    # 13. RECENT ACTIVITIES (100% từ CSDL)
    # ==========================================
    recent_logs = (
        await db.scalars(
            select(ModerationLog)
            .order_by(ModerationLog.created_at.desc())
            .limit(5)
        )
    ).all()

    recent_activities: List[AdminRecentActivityItem] = []
    for log in recent_logs:
        recent_activities.append(
            AdminRecentActivityItem(
                id=str(log.id),
                time=log.created_at.strftime("%d/%m/%Y %H:%M"),
                action=log.action,
                target=log.note or "Thao tác kiểm duyệt",
                actor="Admin",
            )
        )

    # Nếu không có moderation log, lấy từ status log đơn hàng
    if not recent_activities:
        order_logs = (
            await db.scalars(
                select(OrderStatusLog)
                .order_by(OrderStatusLog.created_at.desc())
                .limit(5)
            )
        ).all()
        for olog in order_logs:
            recent_activities.append(
                AdminRecentActivityItem(
                    id=f"ordlog-{olog.id}",
                    time=olog.created_at.strftime("%d/%m/%Y %H:%M"),
                    action=f"Cập nhật đơn hàng: {olog.new_status}",
                    target=f"Đơn hàng #{olog.order_id}",
                    actor="Hệ thống",
                )
            )

    # ==========================================
    # 14. BOTTOM SUMMARY (100% từ CSDL)
    # ==========================================
    ytd_start = datetime(now.year, 1, 1)
    ytd_rev = (
        await db.scalar(
            select(func.coalesce(func.sum(Order.total_amount), Decimal("0"))).where(
                and_(Order.order_status == "COMPLETED", Order.completed_at >= ytd_start)
            )
        )
    ) or Decimal("0")

    ytd_orders = (
        await db.scalar(
            select(func.count(Order.id)).where(Order.created_at >= ytd_start)
        )
    ) or 0

    total_users_all = (await db.scalar(select(func.count(User.id)))) or 0
    total_sellers_all = (
        await db.scalar(select(func.count(SellerProfile.id)).where(SellerProfile.status == "APPROVED"))
    ) or 0

    bottom_summary = AdminBottomSummary(
        year=now.year,
        total_revenue_ytd=ytd_rev,
        total_orders_ytd=ytd_orders,
        total_users=total_users_all,
        total_sellers=total_sellers_all,
        total_products=total_products,
    )

    return AdminComprehensiveDashboardResponse(
        hero_kpis=hero_kpis,
        micro_kpis=micro_kpis,
        revenue_chart=revenue_chart,
        order_status_donut=order_status_donut,
        total_orders_count=cur_orders,
        user_growth_chart=user_growth_chart,
        traffic_sources=traffic_sources,
        total_visits_count=cur_traffic_count,
        payment_breakdown=payment_breakdown,
        total_payment_revenue=total_pay_rev,
        finance_overview=finance_overview,
        top_categories=top_categories,
        top_sellers=top_sellers,
        demographics=demographics,
        top_products=top_products,
        system_alerts=system_alerts,
        hourly_heatmap=heatmap_cells,
        recent_activities=recent_activities,
        bottom_summary=bottom_summary,
    )
