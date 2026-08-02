from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from pydantic import EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import DBSession
from dependencies.auth import CurrentUser
from models.user import User
from services.seller_application_service import (
    get_seller_me,
    submit_seller_application,
    get_my_seller_application,
    update_my_seller_application,
)
from services.seller_order_service import get_seller_dashboard_summary
from schemas.seller_application_schema import (
    SellerMeResponse,
    SellerApplicationResponse,
    SellerApplicationRequest,
    SellerDashboardSummaryResponse,
)


router = APIRouter(prefix="/seller", tags=["Seller"])


@router.get(path="/me", response_model=SellerMeResponse)
async def get_seller_me_api(
    user: CurrentUser,
    db: DBSession,
) -> SellerMeResponse:
    result = None
    try:
        result = await get_seller_me(user, db)
        await db.commit()
    except Exception:
        await db.rollback()
        raise

    return result


@router.post(path="/application", response_model=SellerApplicationResponse)
async def submit_application_api(
    user: CurrentUser,
    data: SellerApplicationRequest,
    db: DBSession,
) -> SellerApplicationResponse:
    result = None
    try:
        result = await submit_seller_application(user, data, db)
        await db.commit()
    except Exception:
        await db.rollback()
        raise

    return result


@router.get(path="/application", response_model=SellerApplicationResponse)
async def get_my_application_api(
    user: CurrentUser,
    db: DBSession,
) -> SellerApplicationResponse:
    result = None
    try:
        result = await get_my_seller_application(user, db)
        await db.commit()
    except Exception:
        await db.rollback()
        raise

    return result


@router.put(path="/application", response_model=SellerApplicationResponse)
async def update_my_application_api(
    user: CurrentUser,
    data: SellerApplicationRequest,
    db: DBSession,
):
    result = None
    try:
        result = await update_my_seller_application(user, data, db)
        await db.commit()
    except Exception:
        await db.rollback()
        raise

    return result


@router.get(path="/dashboard-summary", response_model=SellerDashboardSummaryResponse)
async def get_dashboard_summary_api(
    user: CurrentUser,
    db: DBSession,
) -> SellerDashboardSummaryResponse:
    try:
        result = await get_seller_dashboard_summary(user, db, recalculate=False)
        await db.commit()
        return result
    except HTTPException:
        await db.rollback()
        raise
    except Exception as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi hệ thống khi tải thống kê: {str(exc)}",
        )


@router.post(path="/dashboard-summary/recalculate", response_model=SellerDashboardSummaryResponse)
async def recalculate_dashboard_summary_api(
    user: CurrentUser,
    db: DBSession,
) -> SellerDashboardSummaryResponse:
    try:
        result = await get_seller_dashboard_summary(user, db, recalculate=True)
        await db.commit()
        return result
    except HTTPException:
        await db.rollback()
        raise
    except Exception as exc:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Lỗi hệ thống khi tính toán lại thống kê: {str(exc)}",
        )



