from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from models.catalog import ProductVariant
from models.catalog import Product

from sqlalchemy.orm import selectinload


async def get_variant_by_public_id(
    db: AsyncSession, variant_public_id: str
) -> ProductVariant | None:
    if not variant_public_id:
        return None

    # 1. Search by ProductVariant public_id
    result = await db.execute(
        select(ProductVariant)
        .options(
            selectinload(ProductVariant.inventory), selectinload(ProductVariant.product)
        )
        .where(ProductVariant.public_id == variant_public_id)
    )
    variant = result.scalar_one_or_none()
    if variant:
        return variant

    # 2. Search by ProductVariant numeric integer ID
    if str(variant_public_id).isdigit():
        var_id = int(variant_public_id)
        result = await db.execute(
            select(ProductVariant)
            .options(
                selectinload(ProductVariant.inventory), selectinload(ProductVariant.product)
            )
            .where(ProductVariant.id == var_id)
        )
        variant = result.scalar_one_or_none()
        if variant:
            return variant

    # 3. Fallback: If identifier matches Product ID or Product public_id, find first active variant
    stmt = (
        select(ProductVariant)
        .join(Product, ProductVariant.product_id == Product.id)
        .options(
            selectinload(ProductVariant.inventory), selectinload(ProductVariant.product)
        )
        .where(ProductVariant.status == "ACTIVE")
    )
    if str(variant_public_id).isdigit():
        stmt = stmt.where(
            or_(Product.id == int(variant_public_id), Product.public_id == variant_public_id)
        )
    else:
        stmt = stmt.where(Product.public_id == variant_public_id)

    result = await db.execute(stmt)
    return result.scalars().first()

