from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Numeric, String
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base, utc_now

if TYPE_CHECKING:
    from models.order.order import Order
    from models.seller.seller_payout import SellerPayout


class PlatformFinanceTransaction(Base):
    __tablename__ = "platform_finance_transactions"

    __table_args__ = (
        CheckConstraint(
            "transaction_type IN ('ESCROW_INFLOW', 'ESCROW_RELEASE', 'REVENUE_EARNED', 'PAYOUT_DISBURSED', 'ESCROW_REFUND', 'ADJUSTMENT')",
            name="ck_platform_finance_transactions_type",
        ),
        Index("ix_platform_finance_tx_created_at", "created_at"),
        Index("ix_platform_finance_tx_order_id", "order_id"),
        Index("ix_platform_finance_tx_payout_id", "payout_id"),
        Index("ix_platform_finance_tx_type", "transaction_type"),
    )

    id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        primary_key=True,
        autoincrement=True,
    )
    transaction_type: Mapped[str] = mapped_column(String(30), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    escrow_before: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=Decimal("0.00"),
    )
    escrow_after: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=Decimal("0.00"),
    )
    revenue_before: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=Decimal("0.00"),
    )
    revenue_after: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=Decimal("0.00"),
    )
    order_id: Mapped[int | None] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("orders.id"),
        nullable=True,
    )
    payout_id: Mapped[int | None] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("seller_payouts.id"),
        nullable=True,
    )
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=utc_now,
    )

    order: Mapped["Order | None"] = relationship()
    payout: Mapped["SellerPayout | None"] = relationship()
