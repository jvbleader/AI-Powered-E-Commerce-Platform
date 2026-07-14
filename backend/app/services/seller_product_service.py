from fastapi import HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from repositories.product_repository import (
    create_product,
    get_products_by_seller,
    get_product_by_public_id_and_seller,
    update_product,
    soft_delete_product,
    hide_product
)
from repositories.seller_profile_repository import get_seller_profile_by_user_id
from schemas.seller_product_schema import ProductCreateRequest, ProductUpdateRequest, ProductListResponse, ProductResponse
from models.user import User
from models.product import Product

async def _get_active_seller_profile(user: User, db: AsyncSession):
    seller_profile = await get_seller_profile_by_user_id(user.id, db)
    if not seller_profile or seller_profile.status != "APPROVED":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have an approved seller account."
        )
    return seller_profile

async def create_seller_product(
    user: User, 
    data: ProductCreateRequest, 
    db: AsyncSession
) -> ProductResponse:
    seller_profile = await _get_active_seller_profile(user, db)
    
    product = await create_product(db, seller_profile.id, data)
    return ProductResponse.model_validate(product)

async def get_seller_products(
    user: User, 
    db: AsyncSession, 
    skip: int = 0, 
    limit: int = 100
) -> ProductListResponse:
    seller_profile = await _get_active_seller_profile(user, db)
    
    items, total = await get_products_by_seller(db, seller_profile.id, skip, limit)
    
    return ProductListResponse(
        items=[ProductResponse.model_validate(item) for item in items],
        total=total
    )

async def update_seller_product(
    user: User, 
    product_id: str, 
    data: ProductUpdateRequest, 
    db: AsyncSession
) -> ProductResponse:
    seller_profile = await _get_active_seller_profile(user, db)
    
    product = await get_product_by_public_id_and_seller(db, product_id, seller_profile.id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
        
    updated_product = await update_product(db, product, data)
    return ProductResponse.model_validate(updated_product)

async def delete_seller_product(
    user: User, 
    product_id: str, 
    db: AsyncSession
) -> ProductResponse:
    seller_profile = await _get_active_seller_profile(user, db)
    
    product = await get_product_by_public_id_and_seller(db, product_id, seller_profile.id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
        
    deleted_product = await soft_delete_product(db, product)
    return ProductResponse.model_validate(deleted_product)

async def hide_seller_product(
    user: User, 
    product_id: str, 
    db: AsyncSession
) -> ProductResponse:
    seller_profile = await _get_active_seller_profile(user, db)
    
    product = await get_product_by_public_id_and_seller(db, product_id, seller_profile.id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
        
    hidden_product = await hide_product(db, product)
    return ProductResponse.model_validate(hidden_product)
