from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from models.wallet import Wallet, WalletTransaction


async def get_wallet_by_user_id(
    db: AsyncSession,
    user_id: int,
    *,
    for_update: bool = False,
) -> Optional[Wallet]:
    stmt = select(Wallet).where(Wallet.user_id == user_id)
    if for_update:
        stmt = stmt.with_for_update()
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def create_wallet(db: AsyncSession, wallet: Wallet) -> Wallet:
    db.add(wallet)
    await db.flush()
    return wallet


async def add_wallet_transaction(
    db: AsyncSession, txn: WalletTransaction
) -> WalletTransaction:
    db.add(txn)
    await db.flush()
    return txn


async def get_wallet_transactions(
    db: AsyncSession,
    wallet_id: int,
    *,
    limit: int = 20,
    offset: int = 0,
    transaction_type: Optional[str] = None,
) -> list[WalletTransaction]:
    stmt = (
        select(WalletTransaction)
        .where(WalletTransaction.wallet_id == wallet_id)
        .order_by(WalletTransaction.created_at.desc())
    )
    if transaction_type:
        stmt = stmt.where(WalletTransaction.transaction_type == transaction_type)
    stmt = stmt.limit(limit).offset(offset)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def count_wallet_transactions(
    db: AsyncSession,
    wallet_id: int,
    *,
    transaction_type: Optional[str] = None,
) -> int:
    stmt = (
        select(func.count())
        .select_from(WalletTransaction)
        .where(WalletTransaction.wallet_id == wallet_id)
    )
    if transaction_type:
        stmt = stmt.where(WalletTransaction.transaction_type == transaction_type)
    result = await db.execute(stmt)
    return result.scalar_one()
