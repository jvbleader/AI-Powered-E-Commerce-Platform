from typing import Annotated
from fastapi import APIRouter, Depends, Query, status, BackgroundTasks
from services.search.search_helpers import sync_product_to_es, delete_product_from_es_by_public_id
import services.search.search_service as search_svc
from sqlalchemy.ext.asyncio import AsyncSession
from core.database import DBSession
from dependencies.auth import CurrentUser
from models.user import User
from schemas.seller.seller_product_schema import (
    ProductCreateRequest,
    ProductUpdateRequest,
    ProductListResponse,
    ProductResponse,
)
from services.seller.seller_product_service import (
    create_seller_product,
    get_seller_products,
    update_seller_product,
    delete_seller_product,
    hide_seller_product,
    unhide_seller_product,
)

router = APIRouter(prefix="/seller/products", tags=["Seller Products"])


@router.post("", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
async def create_product_api(
    user: CurrentUser,
    data: ProductCreateRequest,
    db: DBSession,
    background_tasks: BackgroundTasks,
) -> ProductResponse:
    result = None
    try:
        result = await create_seller_product(user, data, db)
        await db.commit()
        background_tasks.add_task(sync_product_to_es, result.public_id)
    except Exception:
        await db.rollback()
        raise
    return result


@router.get("", response_model=ProductListResponse)
async def get_products_api(
    user: CurrentUser,
    db: DBSession,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
) -> ProductListResponse:
    skip = (page - 1) * limit
    result = None
    try:
        result = await get_seller_products(user, db, skip, limit)
        await db.commit()
    except Exception:
        await db.rollback()
        raise
    return result


@router.put("/{product_id}", response_model=ProductResponse)
async def update_product_api(
    product_id: str,
    user: CurrentUser,
    data: ProductUpdateRequest,
    db: DBSession,
    background_tasks: BackgroundTasks,
) -> ProductResponse:
    result = None
    try:
        result = await update_seller_product(user, product_id, data, db)
        await db.commit()
        background_tasks.add_task(sync_product_to_es, result.public_id)
    except Exception:
        await db.rollback()
        raise
    return result


@router.patch("/{product_id}/hide", response_model=ProductResponse)
async def hide_product_api(
    product_id: str,
    user: CurrentUser,
    db: DBSession,
    background_tasks: BackgroundTasks,
) -> ProductResponse:
    result = None
    try:
        result = await hide_seller_product(user, product_id, db)
        await db.commit()
        background_tasks.add_task(delete_product_from_es_by_public_id, result.public_id)
    except Exception:
        await db.rollback()
        raise
    return result


@router.patch("/{product_id}/unhide", response_model=ProductResponse)
async def unhide_product_api(
    product_id: str,
    user: CurrentUser,
    db: DBSession,
    background_tasks: BackgroundTasks,
) -> ProductResponse:
    result = None
    try:
        result = await unhide_seller_product(user, product_id, db)
        await db.commit()
        background_tasks.add_task(sync_product_to_es, result.public_id)
    except Exception:
        await db.rollback()
        raise
    return result


@router.delete("/{product_id}", response_model=ProductResponse)
async def delete_product_api(
    product_id: str,
    user: CurrentUser,
    db: DBSession,
    background_tasks: BackgroundTasks,
) -> ProductResponse:
    result = None
    try:
        result = await delete_seller_product(user, product_id, db)
        await db.commit()
        background_tasks.add_task(delete_product_from_es_by_public_id, result.public_id)
    except Exception:
        await db.rollback()
        raise
    return result

