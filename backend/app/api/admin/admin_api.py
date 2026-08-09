from typing import Annotated, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response, status, HTTPException
from pydantic import BaseModel, EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from schemas.user.user_schema import UserMeResponse, AdminCreateUserRequest, UserRolesUpdateRequest
from schemas.admin.admin_schema import AdminDashboardStatsResponse
import services.auth.auth_service as auth_service

from core.database import DBSession
from models.user import User
from dependencies.auth import CurrentAdmin
from schemas.catalog.category_public_schema import CategoryPublicResponse
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


@router.get(path="/users", response_model=list[UserMeResponse])
async def list_users_api(
    user: CurrentAdmin,
    db: DBSession,
) -> list[UserMeResponse]:
    from sqlalchemy import select
    from models.user import User

    result = await db.execute(select(User).order_by(User.created_at.desc()))
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
) -> list[ProductDetailPublicResponse]:
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload
    from models.catalog import Product
    from models.catalog import ProductVariant

    stmt = (
        select(Product)
        .options(
            selectinload(Product.seller),
            selectinload(Product.categories),
            selectinload(Product.images),
            selectinload(Product.variants).selectinload(ProductVariant.inventory)
        )
        .order_by(Product.created_at.desc())
    )
    res = await db.execute(stmt)
    products = res.scalars().all()
    return products



