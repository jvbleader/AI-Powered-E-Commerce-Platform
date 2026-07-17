from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status, HTTPException
from pydantic import EmailStr
from sqlalchemy.ext.asyncio import AsyncSession
from schemas.user_schema import UserMeResponse, AdminCreateUserRequest, UserRolesUpdateRequest
from services import auth_service

from core.database import get_db
from models.user import User
from dependencies.auth import get_current_admin
from schemas.seller_application_schema import (
    SellerApplicationResponse,
    SellerApplicationDetailResponse,
    ListSellerApplicationsRequest,
    SellerApplicationReviewResponse,
    RejectApplicationRequest,
)
from services.seller_application_service import (
    list_seller_applications,
    get_seller_application_detail,
    approve_seller_application,
    reject_seller_application,
)

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get(path="/seller-applications", response_model=list[SellerApplicationResponse])
async def list_seller_applications_api(
    data: Annotated[ListSellerApplicationsRequest, Depends()],
    user: Annotated[User, Depends(get_current_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
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
    user: Annotated[User, Depends(get_current_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
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
    user: Annotated[User, Depends(get_current_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SellerApplicationReviewResponse:
    result = None
    try:
        result = await approve_seller_application(seller_public_id, db)
        await db.commit()
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
    user: Annotated[User, Depends(get_current_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SellerApplicationReviewResponse:
    result = None
    try:
        result = await reject_seller_application(
            seller_public_id=seller_public_id, data=data, db=db
        )
        await db.commit()
    except Exception:
        await db.rollback()
        raise

    return result


@router.get(path="/users", response_model=list[UserMeResponse])
async def list_users_api(
    user: Annotated[User, Depends(get_current_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
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
    user: Annotated[User, Depends(get_current_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserMeResponse:
    from datetime import datetime
    from repositories.user_repositoriy import (
        get_user_by_email,
        get_user_by_phone,
        get_user_by_user_name,
        create_user,
    )
    from utils.hash_and_verify import hash_password

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
    user: Annotated[User, Depends(get_current_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserMeResponse:
    from sqlalchemy import delete
    from repositories.user_repositoriy import get_user_by_public_id
    from models.user_role import UserRole

    target_user = await get_user_by_public_id(public_id, db)
    if not target_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Người dùng không tồn tại."
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
    user: Annotated[User, Depends(get_current_admin)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> UserMeResponse:
    from datetime import datetime, timedelta
    from repositories.user_repositoriy import get_user_by_public_id

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
