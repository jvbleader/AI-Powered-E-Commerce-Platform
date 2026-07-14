from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from repositories import cart_repository, cart_helper_repository
from schemas.cart_schema import (
    AddToCartRequest,
    UpdateCartItemRequest,
    CartResponse,
    CartItemResponse,
)
from models.user import User


async def get_my_cart(user: User, db: AsyncSession) -> CartResponse:
    cart = await cart_repository.get_cart_by_user_id(db, user.id)
    if not cart:
        cart = await cart_repository.create_cart(db, user.id)
        return CartResponse(
            id=cart.id, items=[], created_at=cart.created_at, updated_at=cart.updated_at
        )

    # We need to map Cart items to CartItemResponse
    items_response = []
    for item in cart.items:
        items_response.append(
            CartItemResponse(
                id=item.id,
                variant_id=item.variant.public_id,
                quantity=item.quantity,
                is_selected=item.is_selected,
                created_at=item.created_at,
                updated_at=item.updated_at,
            )
        )

    return CartResponse(
        id=cart.id,
        items=items_response,
        created_at=cart.created_at,
        updated_at=cart.updated_at,
    )


async def add_to_cart(
    user: User, request: AddToCartRequest, db: AsyncSession
) -> CartItemResponse:
    # Validate variant
    variant = await cart_helper_repository.get_variant_by_public_id(
        db, request.variant_id
    )
    if not variant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Variant not found"
        )

    if (
        variant.status != "ACTIVE"
        or not variant.product
        or variant.product.status != "ACTIVE"
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Product or variant is not active",
        )

    if not variant.inventory or variant.inventory.quantity < request.quantity:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="Not enough stock"
        )

    # Get cart
    cart = await cart_repository.get_cart_by_user_id(db, user.id)
    if not cart:
        cart = await cart_repository.create_cart(db, user.id)

    # Check if variant already in cart
    existing_item = await cart_repository.get_cart_item(db, cart.id, variant.id)
    if existing_item:
        new_quantity = existing_item.quantity + request.quantity
        if variant.inventory.quantity < new_quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Not enough stock for the combined quantity",
            )
        item = await cart_repository.update_cart_item(
            db, existing_item, quantity=new_quantity, is_selected=True
        )
    else:
        item = await cart_repository.add_item_to_cart(
            db, cart.id, variant.id, request.quantity
        )

    return CartItemResponse(
        id=item.id,
        variant_id=variant.public_id,
        quantity=item.quantity,
        is_selected=item.is_selected,
        created_at=item.created_at,
        updated_at=item.updated_at,
    )


async def update_cart_item(
    user: User, item_id: int, request: UpdateCartItemRequest, db: AsyncSession
) -> CartItemResponse:
    cart = await cart_repository.get_cart_by_user_id(db, user.id)
    if not cart:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Cart not found"
        )

    # Find item in cart.items
    target_item = next((item for item in cart.items if item.id == item_id), None)
    if not target_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Cart item not found"
        )

    if request.quantity is not None:
        if (
            not target_item.variant.inventory
            or target_item.variant.inventory.quantity < request.quantity
        ):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Not enough stock"
            )

    updated_item = await cart_repository.update_cart_item(
        db, target_item, quantity=request.quantity, is_selected=request.is_selected
    )

    return CartItemResponse(
        id=updated_item.id,
        variant_id=updated_item.variant.public_id,
        quantity=updated_item.quantity,
        is_selected=updated_item.is_selected,
        created_at=updated_item.created_at,
        updated_at=updated_item.updated_at,
    )


async def remove_cart_item_by_id(user: User, item_id: int, db: AsyncSession) -> None:
    cart = await cart_repository.get_cart_by_user_id(db, user.id)
    if not cart:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Cart not found"
        )

    target_item = next((item for item in cart.items if item.id == item_id), None)
    if not target_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Cart item not found"
        )

    await cart_repository.remove_cart_item(db, target_item)


async def select_all_cart(user: User, is_selected: bool, db: AsyncSession) -> None:
    cart = await cart_repository.get_cart_by_user_id(db, user.id)
    if not cart:
        return
    await cart_repository.select_all_cart_items(db, cart.id, is_selected)
