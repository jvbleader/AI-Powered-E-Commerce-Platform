from typing import Optional
from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from repositories.order_repository import (
    get_orders_by_seller_and_status,
    get_order_by_public_id_and_seller,
    confirm_order,
    update_order_status_to_shipping
)
from repositories.seller_profile_repository import get_seller_profile_by_user_id
from schemas.seller_order_schema import OrderListResponse, OrderResponse
from models.user import User

async def _get_active_seller_profile(user: User, db: AsyncSession):
    seller_profile = await get_seller_profile_by_user_id(user.id, db)
    if not seller_profile or seller_profile.status != "APPROVED":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have an approved seller account."
        )
    return seller_profile

async def get_seller_orders(
    user: User, 
    db: AsyncSession, 
    status_filter: Optional[str] = None,
    skip: int = 0, 
    limit: int = 100
) -> OrderListResponse:
    seller_profile = await _get_active_seller_profile(user, db)
    
    items, total = await get_orders_by_seller_and_status(
        db, seller_profile.id, status_filter, skip, limit
    )
    
    return OrderListResponse(
        items=[OrderResponse.model_validate(item) for item in items],
        total=total
    )

async def confirm_seller_order(
    user: User, 
    order_id: str, 
    db: AsyncSession
) -> OrderResponse:
    seller_profile = await _get_active_seller_profile(user, db)
    
    order = await get_order_by_public_id_and_seller(db, order_id, seller_profile.id)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
        
    if order.seller_confirmed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Order has already been confirmed."
        )
    
    if order.order_status not in ("PLACED",):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"Order cannot be confirmed because it is in {order.order_status} status."
        )
        
    confirmed_order = await confirm_order(db, order)
    return OrderResponse.model_validate(confirmed_order)

async def update_order_to_shipping(
    user: User, 
    order_id: str, 
    db: AsyncSession
) -> OrderResponse:
    seller_profile = await _get_active_seller_profile(user, db)
    
    order = await get_order_by_public_id_and_seller(db, order_id, seller_profile.id)
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Order not found")
        
    if order.order_status != "READY_TO_SHIP":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail=f"Order cannot be shipped because it is in {order.order_status} status."
        )
        
    shipped_order = await update_order_status_to_shipping(db, order)
    return OrderResponse.model_validate(shipped_order)
