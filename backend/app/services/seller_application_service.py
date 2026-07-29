import re
import unicodedata

from datetime import datetime, timedelta, UTC
from fastapi import Depends, status, HTTPException
from typing import Annotated
from sqlalchemy.ext.asyncio import AsyncSession

from models.user import User
from models.seller_profile import SellerProfile
from dependencies.auth import get_current_user, get_current_admin, get_db
from services.auth_service import user_to_response
from schemas.seller_application_schema import (
    SellerMeResponse,
    SellerApplicationResponse,
    SellerApplicationRequest,
    SellerApplicationDetailResponse,
    RejectApplicationRequest,
)
from repositories.seller_profile_repository import (
    get_seller_profile_by_user_id,
    get_seller_profile_by_public_id,
    get_seller_profile_by_shop_name,
    get_seller_profile_by_shop_slug,
    create_seller_profile,
    get_seller_profile_list,
)
from repositories.user_repositoriy import get_user_by_id
from repositories.user_role_repository import add_role_by_user_id


def _generate_slug(value: str) -> str:
    value = value.strip().lower()
    value = unicodedata.normalize("NFKD", value)
    value = "".join(char for char in value if not unicodedata.combining(char))
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = value.strip("-")

    return value


async def _create_unique_shop_slug(shop_name: str, db: AsyncSession) -> str:
    base_slug = _generate_slug(shop_name)
    slug = base_slug
    counter = 2

    while await get_seller_profile_by_shop_slug(slug, db):
        slug = f"{base_slug}-{counter}"
        counter += 1

    return slug


async def get_seller_me(user: User, db: AsyncSession) -> SellerMeResponse:
    result = None
    seller_profile = await get_seller_profile_by_user_id(user.id, db)

    if not seller_profile:
        result = SellerMeResponse(
            has_seller_profile=False, status=None, can_access_seller_dashboard=False
        )
    else:
        result = SellerMeResponse(
            has_seller_profile=True,
            status=seller_profile.status,
            can_access_seller_dashboard=seller_profile.status == "APPROVED",
        )

    return result


async def submit_seller_application(
    user: User, data: SellerApplicationRequest, db: AsyncSession
) -> SellerProfile:
    seller_profile = await get_seller_profile_by_user_id(user.id, db)

    if seller_profile:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn đã có yêu cầu mở shop rồi.",
        )

    if await get_seller_profile_by_shop_name(data.shop_name, db):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tên shop này đã tồn tại, vui lòng chọn tên khác.",
        )

    shop_slug = await _create_unique_shop_slug(data.shop_name, db)

    seller_profile = await create_seller_profile(
        user_id=user.id,
        status="PENDING",
        shop_name=data.shop_name,
        shop_slug=shop_slug,
        phone=data.phone,
        email=data.email,
        pickup_address=data.pickup_address,
        tax_code=data.tax_code,
        bank_name=data.bank_name,
        bank_account_number=data.bank_account_number,
        bank_account_name=data.bank_account_name,
        shipping_fee=data.shipping_fee,
        db=db,
    )

    return seller_profile


async def get_my_seller_application(user: User, db: AsyncSession) -> SellerProfile:
    seller_profile = await get_seller_profile_by_user_id(user.id, db)

    if not seller_profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bạn chưa gửi yêu cầu mở shop.",
        )
    else:
        return seller_profile


async def update_my_seller_application(
    user: User, data: SellerApplicationRequest, db: AsyncSession
) -> SellerProfile:
    seller_profile = await get_seller_profile_by_user_id(user.id, db)

    if not seller_profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Bạn chưa gửi yêu cầu mở shop.",
        )

    if seller_profile.status not in ("PENDING", "REJECTED"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bạn không thể thực hiện thao tác này.",
        )

    if (
        data.shop_name != seller_profile.shop_name
        and await get_seller_profile_by_shop_name(data.shop_name, db)
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Tên shop này đã tồn tại, vui lòng chọn tên khác.",
        )

    shop_slug = seller_profile.shop_slug
    if data.shop_name != seller_profile.shop_name:
        shop_slug = await _create_unique_shop_slug(data.shop_name, db)

    if seller_profile.status == "REJECTED":
        seller_profile.status = "PENDING"
        seller_profile.rejected_reason = None

    seller_profile.shop_name = data.shop_name
    seller_profile.shop_slug = shop_slug
    seller_profile.phone = data.phone
    seller_profile.email = data.email
    seller_profile.pickup_address = data.pickup_address
    seller_profile.tax_code = data.tax_code
    seller_profile.bank_name = data.bank_name
    seller_profile.bank_account_name = data.bank_account_name
    seller_profile.bank_account_number = data.bank_account_number
    seller_profile.shipping_fee = data.shipping_fee

    return seller_profile


async def list_seller_applications(
    db: AsyncSession, page: int = 1, limit: int = 10, status: str | None = None
) -> list[SellerProfile]:
    seller_profiles = await get_seller_profile_list(page, limit, db, status)

    return seller_profiles


async def get_seller_application_detail(
    seller_public_id: str, db: AsyncSession
) -> SellerApplicationDetailResponse:
    seller_profile = await get_seller_profile_by_public_id(seller_public_id, db)

    if not seller_profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Seller profile này không tồn tại.",
        )

    user = await get_user_by_id(seller_profile.user_id, db)

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy user tạo yêu cầu mở shop này.",
        )

    return SellerApplicationDetailResponse(
        user=await user_to_response(user, db), seller_profile=seller_profile
    )


async def approve_seller_application(
    seller_public_id: str, db: AsyncSession
) -> SellerProfile:
    now = datetime.now(UTC)
    seller_profile = await get_seller_profile_by_public_id(seller_public_id, db)

    if not seller_profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Seller profile này không tồn tại.",
        )

    if seller_profile.status != "PENDING":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Không thể thực hiện hành động này.",
        )

    seller_profile.status = "APPROVED"
    seller_profile.approved_at = now
    seller_profile.rejected_reason = None

    user = await get_user_by_id(seller_profile.user_id, db)

    if user:
        await add_role_by_user_id("SELLER", user.id, db)
        await db.flush()
    else:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Không tìm thấy user tạo yêu cầu mở shop này.",
        )

    return seller_profile


async def reject_seller_application(
    seller_public_id: str, data: RejectApplicationRequest, db: AsyncSession
) -> SellerProfile:
    now = datetime.now(UTC)
    seller_profile = await get_seller_profile_by_public_id(seller_public_id, db)

    if not seller_profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Seller profile này không tồn tại.",
        )

    if seller_profile.status != "PENDING":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Không thể thực hiện hành động này.",
        )

    seller_profile.status = "REJECTED"
    seller_profile.approved_at = None
    seller_profile.rejected_reason = data.rejected_reason

    await db.flush()

    return seller_profile
