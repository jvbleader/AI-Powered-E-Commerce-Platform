from datetime import datetime

from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.user import User
from models.user import UserRole


async def get_role_list_by_user_id(user_id: int, db: AsyncSession) -> list[str]:
    result = await db.execute(
        select(UserRole.role_name)
        .where(UserRole.user_id == user_id)
        .order_by(UserRole.role_name)
    )

    return list(result.scalars().all())


async def add_role_by_user_id(role: str, user_id: int, db: AsyncSession):
    user_role = await db.execute(
        select(UserRole).where(UserRole.user_id == user_id, UserRole.role_name == role)
    )
    user_role = user_role.scalar_one_or_none()

    if not user_role:
        db.add(UserRole(user_id=user_id, role_name=role))
        await db.flush()

    return user_role
