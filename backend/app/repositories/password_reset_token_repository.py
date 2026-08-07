from datetime import datetime

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.user import PasswordResetToken


async def delete_password_reset_token_by_user_id(user_id: int, db: AsyncSession):
    await db.execute(
        delete(PasswordResetToken).where(PasswordResetToken.user_id == user_id)
    )
    await db.flush()


async def create_password_reset_token(
    user_id: int,
    token_hash: str,
    expires_at: datetime,
    created_at: datetime,
    db: AsyncSession,
):
    db.add(
        PasswordResetToken(
            user_id=user_id,
            token_hash=token_hash,
            expires_at=expires_at,
            created_at=created_at,
        )
    )

    await db.flush()

    return


async def get_password_reset_token_by_token_hash(token_hash: str, db: AsyncSession):
    result = await db.execute(
        select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash)
    )

    return result.scalar_one_or_none()
