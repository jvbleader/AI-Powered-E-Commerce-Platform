from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from models.user_address import UserAddress


async def get_address_by_id_and_user(
    db: AsyncSession, address_id: int, user_id: int
) -> Optional[UserAddress]:
    stmt = select(UserAddress).where(
        UserAddress.id == address_id, UserAddress.user_id == user_id
    )
    res = await db.execute(stmt)
    return res.scalar_one_or_none()


async def get_user_addresses(db: AsyncSession, user_id: int) -> List[UserAddress]:
    stmt = (
        select(UserAddress)
        .where(UserAddress.user_id == user_id)
        .order_by(UserAddress.created_at.desc())
    )
    res = await db.execute(stmt)
    return list(res.scalars().all())


async def create_user_address(db: AsyncSession, address: UserAddress) -> UserAddress:
    db.add(address)
    await db.flush()
    await db.refresh(address)
    return address


async def unset_user_default_addresses(db: AsyncSession, user_id: int):
    stmt = (
        update(UserAddress)
        .where(UserAddress.user_id == user_id, UserAddress.is_default == True)
        .values(is_default=False)
    )
    await db.execute(stmt)
    await db.flush()


async def delete_user_address(db: AsyncSession, address: UserAddress):
    await db.delete(address)
    await db.flush()
