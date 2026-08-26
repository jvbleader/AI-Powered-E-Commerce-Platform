from __future__ import annotations

from datetime import datetime
from typing import List, Tuple

from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models.seller.seller_payout import SellerPayout
from models.seller.seller_wallet import SellerWallet
from models.seller.seller_wallet_transaction import SellerWalletTransaction


async def get_wallet_by_seller_id(
    seller_id: int, db: AsyncSession
) -> SellerWallet | None:
    result = await db.execute(
        select(SellerWallet).where(SellerWallet.seller_id == seller_id)
    )
    return result.scalar_one_or_none()


async def get_wallet_for_update(
    seller_id: int, db: AsyncSession
) -> SellerWallet | None:
    result = await db.execute(
        select(SellerWallet)
        .where(SellerWallet.seller_id == seller_id)
        .with_for_update()
    )
    return result.scalar_one_or_none()


async def create_wallet(
    wallet: SellerWallet, db: AsyncSession
) -> SellerWallet:
    db.add(wallet)
    await db.flush()
    return wallet


async def add_wallet_transaction(
    tx: SellerWalletTransaction, db: AsyncSession
) -> SellerWalletTransaction:
    db.add(tx)
    await db.flush()
    return tx


async def get_transaction_by_order_id(
    order_id: int, db: AsyncSession
) -> SellerWalletTransaction | None:
    result = await db.execute(
        select(SellerWalletTransaction).where(
            SellerWalletTransaction.order_id == order_id,
            SellerWalletTransaction.transaction_type == "ORDER_SETTLEMENT",
        )
    )
    return result.scalar_one_or_none()


async def get_wallet_transactions(
    seller_id: int,
    db: AsyncSession,
    tx_type: str | None = None,
    start_date: datetime | None = None,
    end_date: datetime | None = None,
    limit: int = 20,
    offset: int = 0,
) -> Tuple[List[SellerWalletTransaction], int]:
    conditions = [SellerWalletTransaction.seller_id == seller_id]
    if tx_type:
        conditions.append(SellerWalletTransaction.transaction_type == tx_type)
    if start_date:
        conditions.append(SellerWalletTransaction.created_at >= start_date)
    if end_date:
        conditions.append(SellerWalletTransaction.created_at <= end_date)

    count_query = select(func.count(SellerWalletTransaction.id)).where(*conditions)
    total_res = await db.execute(count_query)
    total = total_res.scalar() or 0

    query = (
        select(SellerWalletTransaction)
        .options(
            selectinload(SellerWalletTransaction.order),
            selectinload(SellerWalletTransaction.payout),
        )
        .where(*conditions)
        .order_by(desc(SellerWalletTransaction.created_at))
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(query)
    items = list(result.scalars().all())

    return items, total


async def get_seller_payouts(
    seller_id: int,
    db: AsyncSession,
    limit: int = 20,
    offset: int = 0,
) -> Tuple[List[SellerPayout], int]:
    count_query = select(func.count(SellerPayout.id)).where(
        SellerPayout.seller_id == seller_id
    )
    total_res = await db.execute(count_query)
    total = total_res.scalar() or 0

    query = (
        select(SellerPayout)
        .where(SellerPayout.seller_id == seller_id)
        .order_by(desc(SellerPayout.created_at))
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(query)
    items = list(result.scalars().all())

    return items, total


async def create_seller_payout(
    payout: SellerPayout, db: AsyncSession
) -> SellerPayout:
    db.add(payout)
    await db.flush()
    return payout
