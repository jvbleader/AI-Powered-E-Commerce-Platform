from typing import Annotated, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response, status, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from schemas.user.user_schema import UserMeResponse, AdminCreateUserRequest, UserRolesUpdateRequest
from schemas.admin.admin_schema import (
    AdminDashboardStatsResponse,
    AdminDetailedStatsResponse,
    AdminTopProduct,
    AdminTopSeller,
    AdminTimeSeriesData,
    AdminPaymentBreakdown,
    AdminUserBreakdown,
)
import services.auth.auth_service as auth_service

from core.database import DBSession
from models.user import User
from dependencies.auth import CurrentAdmin
from schemas.catalog.category_public_schema import CategoryPublicResponse
from schemas.catalog.category_suggestion_schema import (
    CategorySuggestionPublicResponse,
    CategorySuggestionApproveRequest,
)
from services.catalog.category_suggestion_service import (
    list_admin_category_suggestions,
    approve_category_suggestion,
    reject_category_suggestion,
)
from schemas.catalog.product_public_schema import ProductPublicResponse, ProductDetailPublicResponse
from schemas.seller.seller_application_schema import (
    SellerApplicationResponse,
    SellerApplicationDetailResponse,
    ListSellerApplicationsRequest,
    SellerApplicationReviewResponse,
    RejectApplicationRequest,
)
from services.seller.seller_application_service import (
    list_seller_applications,
    get_seller_application_detail,
    approve_seller_application,
    reject_seller_application,
)
from services.search.search_helpers import (
    sync_product_to_es,
    delete_product_from_es_by_public_id,
    update_shop_in_es,
    reindex_seller_products_in_es,
)

class CreateCategoryRequest(BaseModel):
    name: str
    slug: str
    sort_order: int = 0
    is_default_other: bool = False

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get(path="/dashboard-stats", response_model=AdminDashboardStatsResponse)
async def get_dashboard_stats_api(
    user: CurrentAdmin,
    db: DBSession,
) -> AdminDashboardStatsResponse:
    from sqlalchemy import select, func
    from models.order import Order
    from models.user import User
    from models.seller import SellerProfile

    try:
        revenue_stmt = select(func.sum(Order.total_amount)).where(Order.order_status == "COMPLETED")
        revenue_res = await db.scalar(revenue_stmt)
        total_revenue = revenue_res if revenue_res is not None else 0

        users_stmt = select(func.count(User.id))
        total_users = await db.scalar(users_stmt) or 0

        sellers_stmt = select(func.count(SellerProfile.id)).where(SellerProfile.status == "APPROVED")
        total_sellers = await db.scalar(sellers_stmt) or 0

        pending_apps_stmt = select(func.count(SellerProfile.id)).where(SellerProfile.status == "PENDING")
        pending_apps = await db.scalar(pending_apps_stmt) or 0

        return AdminDashboardStatsResponse(
            total_revenue=total_revenue,
            total_users=total_users,
            total_sellers=total_sellers,
            pending_seller_applications=pending_apps
        )
    except Exception:
        raise


@router.get(path="/statistics/detailed", response_model=AdminDetailedStatsResponse)
async def get_detailed_statistics_api(
    user: CurrentAdmin,
    db: DBSession,
) -> AdminDetailedStatsResponse:
    from sqlalchemy import select, func, and_
    from datetime import datetime, timedelta
    from decimal import Decimal
    from models.order import Order, OrderItem
    from models.user import User, UserRole
    from models.seller import SellerProfile
    from models.catalog import Product, Category, ProductImage

    try:
        # 1. Orders & Revenue KPIs
        revenue_stmt = select(func.sum(Order.total_amount)).where(Order.order_status == "COMPLETED")
        total_revenue = (await db.scalar(revenue_stmt)) or Decimal("0")

        pending_rev_stmt = select(func.sum(Order.total_amount)).where(
            Order.order_status.in_(["PLACED", "READY_TO_SHIP", "SHIPPING"])
        )
        pending_revenue = (await db.scalar(pending_rev_stmt)) or Decimal("0")

        total_orders = (await db.scalar(select(func.count(Order.id)))) or 0
        completed_orders = (await db.scalar(select(func.count(Order.id)).where(Order.order_status == "COMPLETED"))) or 0
        cancelled_orders = (await db.scalar(select(func.count(Order.id)).where(Order.order_status == "CANCELLED"))) or 0

        average_order_value = (total_revenue / completed_orders) if completed_orders > 0 else Decimal("0")

        # 2. Order Status Breakdown
        status_stmt = select(Order.order_status, func.count(Order.id)).group_by(Order.order_status)
        status_res = await db.execute(status_stmt)
        order_status_breakdown = {row[0]: row[1] for row in status_res.all()}

        # 3. Payment Method Breakdown
        payment_stmt = (
            select(
                Order.preferred_payment_method,
                func.sum(Order.total_amount),
                func.count(Order.id),
            )
            .where(Order.order_status == "COMPLETED")
            .group_by(Order.preferred_payment_method)
        )
        payment_res = await db.execute(payment_stmt)
        cod_revenue = Decimal("0")
        cod_count = 0
        vnpay_revenue = Decimal("0")
        vnpay_count = 0

        for method, rev, cnt in payment_res.all():
            m_str = (method or "COD").upper()
            amount = rev or Decimal("0")
            if "VNPAY" in m_str or "ONLINE" in m_str:
                vnpay_revenue += amount
                vnpay_count += cnt
            else:
                cod_revenue += amount
                cod_count += cnt

        payment_breakdown = AdminPaymentBreakdown(
            cod_revenue=cod_revenue,
            cod_count=cod_count,
            vnpay_revenue=vnpay_revenue,
            vnpay_count=vnpay_count,
        )

        # 4. User Breakdown
        role_stmt = select(UserRole.role_name, func.count(UserRole.user_id)).group_by(UserRole.role_name)
        role_res = await db.execute(role_stmt)
        role_map = {row[0]: row[1] for row in role_res.all()}

        total_active_users = (await db.scalar(select(func.count(User.id)).where(User.status == "ACTIVE"))) or 0
        total_locked_users = (await db.scalar(select(func.count(User.id)).where(User.status == "LOCKED"))) or 0

        user_breakdown = AdminUserBreakdown(
            total_customers=role_map.get("CUSTOMER", 0),
            total_sellers=role_map.get("SELLER", 0),
            total_supporters=role_map.get("SUPPORTER", 0),
            total_admins=role_map.get("ADMIN", 0),
            active_users=total_active_users,
            locked_users=total_locked_users,
        )

        # 5. Products & Categories
        total_products = (await db.scalar(select(func.count(Product.id)).where(Product.status != "DELETED"))) or 0
        active_products = (await db.scalar(select(func.count(Product.id)).where(Product.status == "ACTIVE"))) or 0
        hidden_products = (await db.scalar(select(func.count(Product.id)).where(Product.status == "HIDDEN"))) or 0
        total_categories = (await db.scalar(select(func.count(Category.id)))) or 0

        # 6. Daily Stats (Last 30 Days)
        now = datetime.utcnow()
        thirty_days_ago = now - timedelta(days=29)
        day_expr = func.date(func.coalesce(Order.completed_at, Order.created_at))
        daily_orders_stmt = (
            select(
                day_expr.label("day"),
                func.sum(Order.total_amount),
                func.count(Order.id),
            )
            .where(
                and_(
                    Order.order_status == "COMPLETED",
                    func.coalesce(Order.completed_at, Order.created_at) >= thirty_days_ago,
                )
            )
            .group_by(day_expr)
            .order_by(day_expr)
        )
        daily_res = await db.execute(daily_orders_stmt)
        daily_map = {str(row[0]): (row[1] or Decimal("0"), row[2] or 0) for row in daily_res.all()}

        daily_stats = []
        for i in range(30):
            d = (thirty_days_ago + timedelta(days=i)).date()
            d_str = str(d)
            rev, cnt = daily_map.get(d_str, (Decimal("0"), 0))
            daily_stats.append(AdminTimeSeriesData(date=d_str, revenue=rev, orders_count=cnt))

        # 7. Monthly Stats (Last 12 Months)
        monthly_stats = []
        for i in range(11, -1, -1):
            y = now.year
            m = now.month - i
            while m <= 0:
                m += 12
                y -= 1
            m_start = datetime(y, m, 1)
            if m == 12:
                m_end = datetime(y + 1, 1, 1)
            else:
                m_end = datetime(y, m + 1, 1)
            
            m_stmt = select(
                func.sum(Order.total_amount),
                func.count(Order.id)
            ).where(
                and_(
                    Order.order_status == "COMPLETED",
                    func.coalesce(Order.completed_at, Order.created_at) >= m_start,
                    func.coalesce(Order.completed_at, Order.created_at) < m_end
                )
            )
            m_res = await db.execute(m_stmt)
            m_row = m_res.one_or_none()
            m_rev = (m_row[0] if m_row and m_row[0] is not None else Decimal("0"))
            m_cnt = (m_row[1] if m_row and m_row[1] is not None else 0)
            monthly_stats.append(AdminTimeSeriesData(date=f"{m:02d}/{y}", revenue=m_rev, orders_count=m_cnt))

        # 8. Top 5 Products
        top_p_stmt = (
            select(
                Product.id,
                Product.public_id,
                Product.name,
                Product.sold_count,
            )
            .where(Product.status != "DELETED")
            .order_by(Product.sold_count.desc())
            .limit(5)
        )
        top_p_res = await db.execute(top_p_stmt)
        top_products = []
        for p_id, pid, pname, sold in top_p_res.all():
            rev_stmt = (
                select(func.coalesce(func.sum(OrderItem.subtotal), Decimal("0")))
                .join(Order, and_(OrderItem.order_id == Order.id, Order.order_status == "COMPLETED"))
                .where(OrderItem.product_id == p_id)
            )
            prod_rev = (await db.scalar(rev_stmt)) or Decimal("0")

            img_stmt = (
                select(ProductImage.image_url)
                .where(ProductImage.product_id == p_id)
                .order_by(ProductImage.is_thumbnail.desc())
                .limit(1)
            )
            img_url = await db.scalar(img_stmt)
            top_products.append(
                AdminTopProduct(
                    id=pid,
                    name=pname,
                    image_url=img_url,
                    sold_count=sold or 0,
                    revenue=prod_rev,
                )
            )

        # 9. Top 5 Sellers
        top_s_stmt = (
            select(
                SellerProfile.id,
                SellerProfile.public_id,
                SellerProfile.shop_name,
                SellerProfile.shop_logo_url,
                func.count(Order.id),
                func.coalesce(func.sum(Order.total_amount), Decimal("0")),
            )
            .outerjoin(Order, and_(Order.seller_id == SellerProfile.id, Order.order_status == "COMPLETED"))
            .where(SellerProfile.status == "APPROVED")
            .group_by(
                SellerProfile.id,
                SellerProfile.public_id,
                SellerProfile.shop_name,
                SellerProfile.shop_logo_url,
            )
            .order_by(func.coalesce(func.sum(Order.total_amount), Decimal("0")).desc(), func.count(Order.id).desc())
            .limit(5)
        )
        top_s_res = await db.execute(top_s_stmt)
        top_sellers = [
            AdminTopSeller(
                id=row[1],
                shop_name=row[2],
                logo_url=row[3],
                total_orders=row[4],
                total_revenue=row[5],
            )
            for row in top_s_res.all()
        ]

        return AdminDetailedStatsResponse(
            total_revenue=total_revenue,
            pending_revenue=pending_revenue,
            total_orders=total_orders,
            completed_orders=completed_orders,
            cancelled_orders=cancelled_orders,
            average_order_value=average_order_value,
            total_products=total_products,
            active_products=active_products,
            hidden_products=hidden_products,
            total_categories=total_categories,
            user_breakdown=user_breakdown,
            payment_breakdown=payment_breakdown,
            order_status_breakdown=order_status_breakdown,
            daily_stats=daily_stats,
            monthly_stats=monthly_stats,
            top_products=top_products,
            top_sellers=top_sellers,
        )
    except Exception:
        raise

@router.get(path="/seller-applications", response_model=list[SellerApplicationResponse])
async def list_seller_applications_api(
    data: Annotated[ListSellerApplicationsRequest, Depends()],
    user: CurrentAdmin,
    db: DBSession,
) -> list[SellerApplicationResponse]:
    result = None
    try:
        result = await list_seller_applications(
            db=db, page=data.page, limit=data.limit, status=data.status
        )
        await db.commit()
    except Exception:
        await db.rollback()
        raise

    return result


@router.get(
    path="/seller-applications/{seller_public_id}",
    response_model=SellerApplicationDetailResponse,
)
async def get_seller_application_detail_api(
    seller_public_id: str,
    user: CurrentAdmin,
    db: DBSession,
) -> SellerApplicationDetailResponse:
    result = None
    try:
        result = await get_seller_application_detail(seller_public_id, db)
        await db.commit()
    except Exception:
        await db.rollback()
        raise

    return result


@router.patch(
    path="/seller-applications/{seller_public_id}/approve",
    response_model=SellerApplicationReviewResponse,
)
async def approve_seller_application_api(
    seller_public_id: str,
    user: CurrentAdmin,
    db: DBSession,
    background_tasks: BackgroundTasks,
) -> SellerApplicationReviewResponse:
    result = None
    try:
        result = await approve_seller_application(seller_public_id, db)
        await db.commit()
        if result and result.id:
            background_tasks.add_task(update_shop_in_es, result.id)
            background_tasks.add_task(reindex_seller_products_in_es, result.id)
    except Exception:
        await db.rollback()
        raise

    return result


@router.patch(
    path="/seller-applications/{seller_public_id}/reject",
    response_model=SellerApplicationReviewResponse,
)
async def reject_seller_application_api(
    data: RejectApplicationRequest,
    seller_public_id: str,
    user: CurrentAdmin,
    db: DBSession,
    background_tasks: BackgroundTasks,
) -> SellerApplicationReviewResponse:
    result = None
    try:
        result = await reject_seller_application(
            seller_public_id=seller_public_id, data=data, db=db
        )
        await db.commit()
        # Non-APPROVED shops are removed from the shop index
        if result and result.id:
            background_tasks.add_task(update_shop_in_es, result.id)
    except Exception:
        await db.rollback()
        raise

    return result


ALLOWED_ROLES = {"ADMIN", "MANAGER", "SUPPORTER", "SELLER", "BUYER", "CUSTOMER"}


@router.get(path="/users", response_model=list[UserMeResponse])
async def list_users_api(
    user: CurrentAdmin,
    db: DBSession,
    limit: int = 100,
    offset: int = 0,
) -> list[UserMeResponse]:
    from sqlalchemy import select
    from models.user import User

    safe_limit = min(max(1, limit), 200)
    result = await db.execute(
        select(User)
        .order_by(User.created_at.desc())
        .limit(safe_limit)
        .offset(offset)
    )
    users = result.scalars().all()
    
    response_users = []
    for u in users:
        resp = await auth_service.user_to_response(u, db)
        response_users.append(resp)
    return response_users


@router.post(path="/users", response_model=UserMeResponse)
async def create_user_api(
    data: AdminCreateUserRequest,
    user: CurrentAdmin,
    db: DBSession,
) -> UserMeResponse:
    from datetime import datetime
    from repositories.user.user_repository import (
        get_user_by_email,
        get_user_by_phone,
        get_user_by_user_name,
        create_user,
    )
    from utils.hash_and_verify import hash_password

    # Validate mutually exclusive roles
    if "ADMIN" in data.roles and "SUPPORTER" in data.roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Một tài khoản không thể cùng lúc có cả quyền Admin và Supporter.",
        )

    # Validate unique constraints
    if await get_user_by_email(email=data.email, db=db) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Email này đã được sử dụng."
        )

    if await get_user_by_phone(phone=data.phone, db=db) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Số điện thoại này đã được sử dụng.",
        )

    # Generate a unique username
    base_username = data.email.split("@")[0][:30]
    username = base_username
    counter = 1
    while await get_user_by_user_name(user_name=username, db=db) is not None:
        username = f"{base_username[:25]}_{counter}"
        counter += 1

    try:
        new_user = await create_user(
            {
                "full_name": data.full_name,
                "user_name": username,
                "email": data.email,
                "phone": data.phone,
                "password_hash": hash_password(data.password),
                "email_verified_at": datetime.utcnow(),
                "phone_verified_at": datetime.utcnow(),
                "status": "ACTIVE",
            },
            db=db,
            roles=data.roles,
        )
        await db.commit()
    except Exception:
        await db.rollback()
        raise

    return await auth_service.user_to_response(new_user, db)


@router.get(path="/users/{public_id}", response_model=UserMeResponse)
async def get_user_detail_api(
    public_id: str,
    user: CurrentAdmin,
    db: DBSession,
) -> UserMeResponse:
    from repositories.user.user_repository import get_user_by_public_id

    target_user = await get_user_by_public_id(public_id, db)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Người dùng không tồn tại."
        )

    return await auth_service.user_to_response(target_user, db)


@router.put(path="/users/{public_id}/roles", response_model=UserMeResponse)
async def update_user_roles_api(
    public_id: str,
    data: UserRolesUpdateRequest,
    user: CurrentAdmin,
    db: DBSession,
) -> UserMeResponse:
    from sqlalchemy import delete
    from repositories.user.user_repository import get_user_by_public_id
    from models.user import UserRole

    target_user = await get_user_by_public_id(public_id, db)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Người dùng không tồn tại."
        )

    invalid_roles = [r for r in data.roles if r not in ALLOWED_ROLES]
    if invalid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Role không hợp lệ: {', '.join(invalid_roles)}. Các role hợp lệ: {', '.join(sorted(ALLOWED_ROLES))}.",
        )

    if "ADMIN" in data.roles and "SUPPORTER" in data.roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Một tài khoản không thể cùng lúc có cả quyền Admin và Supporter.",
        )

    # Prevent current admin from self-revoking ADMIN role
    if target_user.id == user.id and "ADMIN" not in data.roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không thể tự thu hồi quyền Admin của chính mình.",
        )

    try:
        # Delete old roles
        await db.execute(delete(UserRole).where(UserRole.user_id == target_user.id))
        
        # Insert new roles
        for r_name in data.roles:
            db.add(UserRole(user_id=target_user.id, role_name=r_name))
        
        await db.flush()
        await db.commit()
    except Exception:
        await db.rollback()
        raise

    return await auth_service.user_to_response(target_user, db)


@router.post(path="/users/{public_id}/toggle-lock", response_model=UserMeResponse)
async def toggle_user_lock_api(
    public_id: str,
    user: CurrentAdmin,
    db: DBSession,
) -> UserMeResponse:

    from datetime import datetime, timedelta
    from repositories.user.user_repository import get_user_by_public_id

    target_user = await get_user_by_public_id(public_id, db)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Người dùng không tồn tại."
        )

    if target_user.id == user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Không thể tự khóa tài khoản của chính mình.",
        )

    try:
        if target_user.status == "LOCKED":
            target_user.status = "ACTIVE"
            target_user.locked_until = None
            target_user.lock_reason = None
        else:
            target_user.status = "LOCKED"
            target_user.locked_until = datetime.utcnow() + timedelta(days=30)
            target_user.lock_reason = "Admin khóa thủ công từ dashboard."
        
        await db.flush()
        await db.commit()
    except Exception:
        await db.rollback()
        raise

    return await auth_service.user_to_response(target_user, db)


@router.post(path="/statistics/recalculate")
async def recalculate_statistics_api(
    user: CurrentAdmin,
    db: DBSession,
) -> dict:
    from services.admin.statistics_service import recalculate_all_statistics
    return await recalculate_all_statistics(db)


@router.get(path="/violation-reports", response_model=list)
async def list_violation_reports_admin_api(
    user: CurrentAdmin,
    db: DBSession,
    status: str | None = None,
    page: int = 1,
    limit: int = 50,
):
    from services.moderation.violation_report_service import list_violation_reports
    return await list_violation_reports(db, status_filter=status, page=page, limit=limit)


@router.patch(path="/products/{public_id}/hide")
async def hide_product_admin_api(
    public_id: str,
    user: CurrentAdmin,
    db: DBSession,
    background_tasks: BackgroundTasks,
):
    from sqlalchemy import select
    from models.catalog import Product
    from models.moderation import ModerationLog
    from repositories.catalog.product_repository import hide_product

    product = await db.scalar(select(Product).where(Product.public_id == public_id))
    if not product:
        raise HTTPException(status_code=404, detail="Sản phẩm không tồn tại")

    if product.status == "HIDDEN":
        return {"message": "Sản phẩm đã bị ẩn trước đó", "public_id": product.public_id}

    await hide_product(db, product)

    # Ghi log thao tác
    log = ModerationLog(
        action="HIDE_PRODUCT",
        product_id=product.id,
        note="Admin ẩn sản phẩm từ trang quản lý.",
    )
    db.add(log)

    await db.commit()
    background_tasks.add_task(delete_product_from_es_by_public_id, public_id)
    return {"message": "Đã ẩn sản phẩm thành công", "public_id": product.public_id}


@router.patch(path="/products/{public_id}/unhide")
async def unhide_product_admin_api(
    public_id: str,
    user: CurrentAdmin,
    db: DBSession,
    background_tasks: BackgroundTasks,
):
    from sqlalchemy import select
    from models.catalog import Product
    from repositories.catalog.product_repository import unhide_product

    product = await db.scalar(select(Product).where(Product.public_id == public_id))
    if not product:
        raise HTTPException(status_code=404, detail="Sản phẩm không tồn tại")

    if product.status == "ACTIVE":
        return {"message": "Sản phẩm đã hiện trước đó", "public_id": product.public_id}

    await unhide_product(db, product)

    # (Bỏ log do không có action UNHIDE_PRODUCT trong DB constraint)

    await db.commit()
    background_tasks.add_task(sync_product_to_es, public_id)
    return {"message": "Đã hiện sản phẩm thành công", "public_id": product.public_id}


@router.delete(path="/products/{public_id}")
async def delete_product_admin_api(
    public_id: str,
    user: CurrentAdmin,
    db: DBSession,
    background_tasks: BackgroundTasks,
):
    from sqlalchemy import select
    from models.catalog import Product
    from models.moderation import ModerationLog
    from repositories.catalog.product_repository import soft_delete_product

    product = await db.scalar(select(Product).where(Product.public_id == public_id))
    if not product:
        raise HTTPException(status_code=404, detail="Sản phẩm không tồn tại")

    if product.status == "DELETED":
        return {"message": "Sản phẩm đã bị xoá trước đó", "public_id": product.public_id}

    await soft_delete_product(db, product)

    # Ghi log thao tác
    log = ModerationLog(
        action="DELETE_PRODUCT",
        product_id=product.id,
        note="Admin xoá sản phẩm từ trang quản lý.",
    )
    db.add(log)

    await db.commit()
    background_tasks.add_task(delete_product_from_es_by_public_id, public_id)
    return {"message": "Đã xoá sản phẩm thành công", "public_id": product.public_id}


@router.patch(path="/violation-reports/{report_id}/status")
async def update_violation_report_status_admin_api(
    report_id: int,
    data: dict,
    user: CurrentAdmin,
    db: DBSession,
):
    from services.moderation.violation_report_service import update_violation_report_status
    new_status = data.get("status")
    if not new_status:
        raise HTTPException(status_code=400, detail="Trạng thái không được để trống")
    res = await update_violation_report_status(db, report_id, new_status)
    await db.commit()
    return res


@router.post(path="/categories", response_model=CategoryPublicResponse)
async def create_category_admin_api(
    data: CreateCategoryRequest,
    user: CurrentAdmin,
    db: DBSession,
) -> CategoryPublicResponse:
    from models.catalog import Category
    from sqlalchemy.exc import IntegrityError

    new_category = Category(
        name=data.name,
        slug=data.slug,
        sort_order=data.sort_order,
        is_default_other=data.is_default_other
    )
    db.add(new_category)
    try:
        await db.commit()
        await db.refresh(new_category)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Tên hoặc Slug của danh mục đã tồn tại.")
    return new_category


@router.delete(path="/categories/{category_id}")
async def delete_category_admin_api(
    category_id: int,
    user: CurrentAdmin,
    db: DBSession,
):
    from sqlalchemy import select
    from models.catalog import Category

    category = await db.scalar(select(Category).where(Category.id == category_id))
    if not category:
        raise HTTPException(status_code=404, detail="Danh mục không tồn tại")

    if category.is_default_other:
        raise HTTPException(status_code=400, detail="Không thể xoá danh mục mặc định 'Khác'. Vui lòng thiết lập danh mục khác làm mặc định trước khi xoá.")

    from models.catalog import ProductCategory
    
    # 1. Tìm các sản phẩm đang được gắn danh mục này
    product_ids_stmt = select(ProductCategory.product_id).where(ProductCategory.category_id == category_id)
    product_ids_res = await db.execute(product_ids_stmt)
    affected_product_ids = [row[0] for row in product_ids_res.all()]

    # 2. Xoá danh mục (SQLAlchemy cascade sẽ tự động xoá các record trong ProductCategory)
    await db.delete(category)
    await db.flush()

    # 3. Tìm danh mục "Khác" mặc định để gán cho các sản phẩm bị mồ côi danh mục
    default_category = await db.scalar(select(Category).where(Category.is_default_other == True).limit(1))
    
    if default_category and affected_product_ids:
        # Kiểm tra xem các sản phẩm bị ảnh hưởng còn danh mục nào khác không
        remaining_cat_stmt = select(ProductCategory.product_id).where(ProductCategory.product_id.in_(affected_product_ids))
        remaining_res = await db.execute(remaining_cat_stmt)
        products_with_cats = {row[0] for row in remaining_res.all()}
        
        orphaned_product_ids = set(affected_product_ids) - products_with_cats
        
        # Gán các sản phẩm mồ côi vào danh mục mặc định
        for pid in orphaned_product_ids:
            db.add(ProductCategory(product_id=pid, category_id=default_category.id))

    await db.commit()
    return {"message": "Đã xoá danh mục thành công"}


@router.get(path="/products", response_model=list[ProductDetailPublicResponse])
async def list_products_admin_api(
    user: CurrentAdmin,
    db: DBSession,
    limit: int = 100,
    offset: int = 0,
) -> list[ProductDetailPublicResponse]:
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from models.catalog import Product
    from models.catalog import ProductVariant
    from models.seller.seller_profile import SellerProfile

    safe_limit = min(max(1, limit), 200)
    stmt = (
        select(Product)
        .options(
            selectinload(Product.seller).selectinload(SellerProfile.shipping_providers),
            selectinload(Product.categories),
            selectinload(Product.images),
            selectinload(Product.variants).selectinload(ProductVariant.inventory)
        )
        .order_by(Product.created_at.desc())
        .limit(safe_limit)
        .offset(offset)
    )
    res = await db.execute(stmt)
    products = res.scalars().all()
    return products


@router.get(path="/category-suggestions", response_model=list[CategorySuggestionPublicResponse])
async def list_category_suggestions_admin_api(
    user: CurrentAdmin,
    db: DBSession,
    status: Optional[str] = None,
) -> list[CategorySuggestionPublicResponse]:
    result = await list_admin_category_suggestions(db, status_filter=status)
    return result


@router.post(path="/category-suggestions/{suggestion_id}/approve", response_model=CategoryPublicResponse)
async def approve_category_suggestion_admin_api(
    suggestion_id: int,
    user: CurrentAdmin,
    db: DBSession,
    data: Optional[CategorySuggestionApproveRequest] = None,
) -> CategoryPublicResponse:
    try:
        new_category = await approve_category_suggestion(db, suggestion_id, data)
        await db.commit()
        return new_category
    except Exception:
        await db.rollback()
        raise


@router.post(path="/category-suggestions/{suggestion_id}/reject", response_model=CategorySuggestionPublicResponse)
async def reject_category_suggestion_admin_api(
    suggestion_id: int,
    user: CurrentAdmin,
    db: DBSession,
) -> CategorySuggestionPublicResponse:
    try:
        rejected = await reject_category_suggestion(db, suggestion_id)
        await db.commit()
        return rejected
    except Exception:
        await db.rollback()
        raise



