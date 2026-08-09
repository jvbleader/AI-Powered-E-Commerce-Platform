from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from models.payment import Payment
from models.payment import PaymentOrder


async def create_payment(db: AsyncSession, payment: Payment) -> Payment:
    db.add(payment)
    await db.flush()
    return payment


async def create_payment_order(
    db: AsyncSession, payment_order: PaymentOrder
) -> PaymentOrder:
    db.add(payment_order)
    await db.flush()
    return payment_order


async def get_payment_by_code_with_orders(
    db: AsyncSession, payment_code: str
) -> Optional[Payment]:
    stmt = (
        select(Payment)
        .options(selectinload(Payment.order_links).selectinload(PaymentOrder.order))
        .where(Payment.payment_code == payment_code)
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()
