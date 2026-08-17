from __future__ import annotations

import re
import unicodedata
from typing import Optional

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from models.base import utc_now
from models.catalog.category import Category
from models.catalog.category_suggestion import CategorySuggestion
from models.seller.seller_profile import SellerProfile
from models.user import User
from schemas.catalog.category_public_schema import CategoryPublicResponse
from schemas.catalog.category_suggestion_schema import (
    CategorySuggestionApproveRequest,
    CategorySuggestionCreateRequest,
    CategorySuggestionPublicResponse,
)


def _generate_slug(value: str) -> str:
    value = value.strip().lower()
    value = unicodedata.normalize("NFKD", value)
    value = "".join(char for char in value if not unicodedata.combining(char))
    value = value.replace("đ", "d").replace("Đ", "d")
    value = re.sub(r"[^a-z0-9]+", "-", value)
    value = value.strip("-")
    return value


async def _create_unique_category_slug(name: str, db: AsyncSession) -> str:
    base_slug = _generate_slug(name)
    if not base_slug:
        base_slug = "danh-muc-moi"
    slug = base_slug
    counter = 2

    while True:
        existing = await db.scalar(select(Category.id).where(Category.slug == slug))
        if not existing:
            break
        slug = f"{base_slug}-{counter}"
        counter += 1

    return slug


async def create_category_suggestion(
    user: User,
    data: CategorySuggestionCreateRequest,
    db: AsyncSession,
) -> CategorySuggestionPublicResponse:
    seller_profile = await db.scalar(
        select(SellerProfile).where(SellerProfile.user_id == user.id)
    )
    if not seller_profile:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tài khoản của bạn chưa đăng ký người bán.",
        )

    suggested_name = data.suggested_name.strip()
    if not suggested_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tên danh mục đề xuất không được để trống.",
        )

    suggestion = CategorySuggestion(
        seller_id=seller_profile.id,
        suggested_name=suggested_name,
        reason=data.reason.strip() if data.reason else None,
        status="PENDING",
    )
    db.add(suggestion)
    await db.flush()
    await db.refresh(suggestion)

    return CategorySuggestionPublicResponse(
        id=suggestion.id,
        seller_id=suggestion.seller_id,
        shop_name=seller_profile.shop_name,
        shop_slug=seller_profile.shop_slug,
        suggested_name=suggestion.suggested_name,
        reason=suggestion.reason,
        status=suggestion.status,
        created_at=suggestion.created_at,
        resolved_at=suggestion.resolved_at,
    )


async def get_seller_category_suggestions(
    user: User,
    db: AsyncSession,
) -> list[CategorySuggestionPublicResponse]:
    seller_profile = await db.scalar(
        select(SellerProfile).where(SellerProfile.user_id == user.id)
    )
    if not seller_profile:
        return []

    stmt = (
        select(CategorySuggestion)
        .where(CategorySuggestion.seller_id == seller_profile.id)
        .order_by(CategorySuggestion.created_at.desc())
    )
    result = await db.execute(stmt)
    suggestions = result.scalars().all()

    return [
        CategorySuggestionPublicResponse(
            id=s.id,
            seller_id=s.seller_id,
            shop_name=seller_profile.shop_name,
            shop_slug=seller_profile.shop_slug,
            suggested_name=s.suggested_name,
            reason=s.reason,
            status=s.status,
            created_at=s.created_at,
            resolved_at=s.resolved_at,
        )
        for s in suggestions
    ]


async def list_admin_category_suggestions(
    db: AsyncSession,
    status_filter: Optional[str] = None,
) -> list[CategorySuggestionPublicResponse]:
    stmt = (
        select(CategorySuggestion, SellerProfile)
        .join(SellerProfile, CategorySuggestion.seller_id == SellerProfile.id)
    )

    if status_filter and status_filter.upper() != "ALL":
        stmt = stmt.where(CategorySuggestion.status == status_filter.upper())

    stmt = stmt.order_by(CategorySuggestion.created_at.desc())
    result = await db.execute(stmt)
    rows = result.all()

    return [
        CategorySuggestionPublicResponse(
            id=cs.id,
            seller_id=cs.seller_id,
            shop_name=sp.shop_name,
            shop_slug=sp.shop_slug,
            suggested_name=cs.suggested_name,
            reason=cs.reason,
            status=cs.status,
            created_at=cs.created_at,
            resolved_at=cs.resolved_at,
        )
        for cs, sp in rows
    ]


async def approve_category_suggestion(
    db: AsyncSession,
    suggestion_id: int,
    data: Optional[CategorySuggestionApproveRequest] = None,
) -> CategoryPublicResponse:
    suggestion = await db.scalar(
        select(CategorySuggestion).where(CategorySuggestion.id == suggestion_id)
    )
    if not suggestion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Đề xuất danh mục không tồn tại.",
        )

    cat_name = (data.name.strip() if data and data.name else suggestion.suggested_name.strip())
    if not cat_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tên danh mục không được để trống.",
        )

    if data and data.slug and data.slug.strip():
        slug = _generate_slug(data.slug)
    else:
        slug = await _create_unique_category_slug(cat_name, db)

    if data and data.sort_order is not None:
        sort_order = data.sort_order
    else:
        max_sort = await db.scalar(select(func.max(Category.sort_order)))
        sort_order = (max_sort or 0) + 1

    is_default_other = data.is_default_other if data else False

    new_category = Category(
        name=cat_name,
        slug=slug,
        sort_order=sort_order,
        is_default_other=is_default_other,
    )
    db.add(new_category)

    suggestion.status = "APPROVED"
    suggestion.resolved_at = utc_now()

    try:
        await db.flush()
        await db.refresh(new_category)
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tên hoặc Slug của danh mục đã tồn tại trong hệ thống.",
        )

    return new_category


async def reject_category_suggestion(
    db: AsyncSession,
    suggestion_id: int,
) -> CategorySuggestionPublicResponse:
    stmt = (
        select(CategorySuggestion, SellerProfile)
        .join(SellerProfile, CategorySuggestion.seller_id == SellerProfile.id)
        .where(CategorySuggestion.id == suggestion_id)
    )
    res = await db.execute(stmt)
    row = res.first()
    if not row:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Đề xuất danh mục không tồn tại.",
        )

    cs, sp = row
    cs.status = "REJECTED"
    cs.resolved_at = utc_now()
    await db.flush()
    await db.refresh(cs)

    return CategorySuggestionPublicResponse(
        id=cs.id,
        seller_id=cs.seller_id,
        shop_name=sp.shop_name,
        shop_slug=sp.shop_slug,
        suggested_name=cs.suggested_name,
        reason=cs.reason,
        status=cs.status,
        created_at=cs.created_at,
        resolved_at=cs.resolved_at,
    )
