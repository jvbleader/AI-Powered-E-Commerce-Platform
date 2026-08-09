from typing import Annotated, List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import DBSession
from dependencies.auth import CurrentUser
from models.user import User
from schemas.user.user_address_schema import (
    UserAddressCreate,
    UserAddressUpdate,
    UserAddressResponse,
)
from schemas.auth.auth_schema import MessageResponse
import services.user.user_address_service as user_address_service

router = APIRouter(prefix="/addresses", tags=["User Addresses"])


@router.get("", response_model=List[UserAddressResponse])
async def get_my_addresses(
    user: CurrentUser,
    db: DBSession,
):
    return await user_address_service.get_my_addresses(user, db)


@router.post(
    "", response_model=UserAddressResponse, status_code=status.HTTP_201_CREATED
)
async def create_address(
    user: CurrentUser,
    data: UserAddressCreate,
    db: DBSession,
):
    try:
        result = await user_address_service.create_address(user, data, db)
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    return result


@router.put("/{address_id}", response_model=UserAddressResponse)
async def update_address(
    address_id: int,
    user: CurrentUser,
    data: UserAddressUpdate,
    db: DBSession,
):
    try:
        result = await user_address_service.update_address(user, address_id, data, db)
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    return result


@router.delete("/{address_id}", response_model=MessageResponse)
async def delete_address(
    address_id: int,
    user: CurrentUser,
    db: DBSession,
):
    try:
        await user_address_service.delete_address(user, address_id, db)
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    return MessageResponse(message="Đã xóa địa chỉ")

