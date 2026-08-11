from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models.shipping.shipping_provider import ShippingProvider


async def get_all_active_shipping_providers(db: AsyncSession) -> list[ShippingProvider]:
    result = await db.execute(select(ShippingProvider).where(ShippingProvider.active == True))
    return list(result.scalars().all())


async def get_shipping_providers_by_public_ids(
    public_ids: list[str], db: AsyncSession
) -> list[ShippingProvider]:
    result = await db.execute(
        select(ShippingProvider).where(ShippingProvider.public_id.in_(public_ids))
    )
    return list(result.scalars().all())
