from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
)
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base, utc_now

if TYPE_CHECKING:
    from .wallet import Wallet


class WalletTransaction(Base):
    __tablename__ = "wallet_transactions"

    __table_args__ = (
        CheckConstraint(
            "transaction_type IN ('TOPUP', 'ORDER_PAYMENT', 'REFUND_ORDER', 'WITHDRAWAL')",
            name="ck_wallet_transactions_type",
        ),
        Index("ix_wallet_transactions_wallet_id", "wallet_id"),
        Index("ix_wallet_transactions_transaction_type", "transaction_type"),
        Index("ix_wallet_transactions_created_at", "created_at"),
    )

    id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        primary_key=True,
        autoincrement=True,
    )
    wallet_id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("wallets.id"),
        nullable=False,
    )
    transaction_code: Mapped[str] = mapped_column(
        String(50), unique=True, nullable=False
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    balance_before: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    balance_after: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    transaction_type: Mapped[str] = mapped_column(String(50), nullable=False)
    reference_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    reference_id: Mapped[int | None] = mapped_column(
        mysql.BIGINT(unsigned=True), nullable=True
    )
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=utc_now
    )

    wallet: Mapped["Wallet"] = relationship(back_populates="transactions")
