from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from models.product_variant import ProductVariant
from models.product import Product

from sqlalchemy.orm import selectinload


async def get_variant_by_public_id(
    db: AsyncSession, variant_public_id: str
) -> ProductVariant | None:
    result = await db.execute(
        select(ProductVariant)
        .options(
            selectinload(ProductVariant.inventory), selectinload(ProductVariant.product)
        )
        .where(ProductVariant.public_id == variant_public_id)
    )
    return result.scalar_one_or_none()
