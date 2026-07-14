from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from models.inventory import Inventory
from models.inventory_transaction import InventoryTransaction


async def get_inventories_for_update(
    db: AsyncSession, variant_ids: List[int]
) -> List[Inventory]:
    stmt = (
        select(Inventory).where(Inventory.variant_id.in_(variant_ids)).with_for_update()
    )
    result = await db.execute(stmt)
    return result.scalars().all()


async def get_inventory_for_update(
    db: AsyncSession, variant_id: int
) -> Optional[Inventory]:
    stmt = select(Inventory).where(Inventory.variant_id == variant_id).with_for_update()
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def add_inventory_transaction(
    db: AsyncSession, transaction: InventoryTransaction
) -> InventoryTransaction:
    db.add(transaction)
    await db.flush()
    return transaction
