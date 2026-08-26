from __future__ import annotations

from typing import List, Tuple
from sqlalchemy import desc, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from models.platform.platform_finance_summary import PlatformFinanceSummary
from models.platform.platform_finance_transaction import PlatformFinanceTransaction


async def get_platform_summary(db: AsyncSession) -> PlatformFinanceSummary | None:
    result = await db.execute(select(PlatformFinanceSummary).limit(1))
    return result.scalar_one_or_none()


async def get_platform_summary_for_update(db: AsyncSession) -> PlatformFinanceSummary | None:
    result = await db.execute(select(PlatformFinanceSummary).with_for_update().limit(1))
    return result.scalar_one_or_none()


async def create_platform_summary(
    summary: PlatformFinanceSummary, db: AsyncSession
) -> PlatformFinanceSummary:
    db.add(summary)
    await db.flush()
    return summary


async def add_platform_transaction(
    tx: PlatformFinanceTransaction, db: AsyncSession
) -> PlatformFinanceTransaction:
    db.add(tx)
    await db.flush()
    return tx


async def get_platform_transactions(
    db: AsyncSession,
    tx_type: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> Tuple[List[PlatformFinanceTransaction], int]:
    conditions = []
    if tx_type:
        conditions.append(PlatformFinanceTransaction.transaction_type == tx_type)

    count_query = select(func.count(PlatformFinanceTransaction.id))
    if conditions:
        count_query = count_query.where(*conditions)
    total_res = await db.execute(count_query)
    total = total_res.scalar() or 0

    query = (
        select(PlatformFinanceTransaction)
        .options(
            selectinload(PlatformFinanceTransaction.order),
            selectinload(PlatformFinanceTransaction.payout),
        )
        .order_by(desc(PlatformFinanceTransaction.created_at))
        .offset(offset)
        .limit(limit)
    )
    if conditions:
        query = query.where(*conditions)

    result = await db.execute(query)
    items = list(result.scalars().all())

    return items, total
