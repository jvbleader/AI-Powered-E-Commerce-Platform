from typing import Annotated

from fastapi import APIRouter, Depends, Request, Response, status
from pydantic import EmailStr
from sqlalchemy.ext.asyncio import AsyncSession

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
