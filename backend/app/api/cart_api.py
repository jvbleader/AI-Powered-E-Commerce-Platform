from typing import Annotated
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from dependencies.auth import get_current_user
from models.user import User
from schemas.cart_schema import (
    AddToCartRequest,
    UpdateCartItemRequest,
    CartResponse,
    CartItemResponse,
)
from schemas.auth_schema import MessageResponse
from services import cart_service

router = APIRouter(prefix="/api/v1/cart", tags=["Cart"])


@router.get("", response_model=CartResponse)
async def get_cart(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    return await cart_service.get_my_cart(user, db)


@router.post(
    "/items", response_model=CartItemResponse, status_code=status.HTTP_201_CREATED
)
async def add_cart_item(
    user: Annotated[User, Depends(get_current_user)],
    data: AddToCartRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    try:
        result = await cart_service.add_to_cart(user, data, db)
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    return result


@router.patch("/items/{item_id}", response_model=CartItemResponse)
async def update_cart_item(
    item_id: int,
    user: Annotated[User, Depends(get_current_user)],
    data: UpdateCartItemRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    try:
        result = await cart_service.update_cart_item(user, item_id, data, db)
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    return result


@router.delete("/items/{item_id}", response_model=MessageResponse)
async def remove_cart_item(
    item_id: int,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    try:
        await cart_service.remove_cart_item_by_id(user, item_id, db)
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    return MessageResponse(message="Đã xóa sản phẩm khỏi giỏ hàng")


@router.patch("/select-all", response_model=MessageResponse)
async def select_all_items(
    is_selected: bool,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
):
    try:
        await cart_service.select_all_cart(user, is_selected, db)
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    return MessageResponse(message="Đã cập nhật trạng thái chọn tất cả")
