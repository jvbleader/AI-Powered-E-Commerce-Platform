from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
)
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base, utc_now

if TYPE_CHECKING:
    from models.user import User
    from .wallet_transaction import WalletTransaction


class Wallet(Base):
    __tablename__ = "wallets"

    __table_args__ = (
        CheckConstraint("balance >= 0", name="ck_wallets_balance"),
        CheckConstraint(
            "status IN ('ACTIVE', 'LOCKED')",
            name="ck_wallets_status",
        ),
        Index("ix_wallets_status", "status"),
    )

    id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        primary_key=True,
        autoincrement=True,
    )
    user_id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("users.id"),
        unique=True,
        nullable=False,
    )
    balance: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        default=Decimal("0.00"),
    )
    pin_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    pin_set_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    pin_failed_attempts: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    pin_locked_until: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True
    )
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, default="ACTIVE"
    )
    bank_name: Mapped[str | None] = mapped_column(String(100), nullable=True)
    bank_account_number: Mapped[str | None] = mapped_column(
        String(50), nullable=True
    )
    bank_account_name: Mapped[str | None] = mapped_column(
        String(150), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=utc_now
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime, nullable=True, onupdate=utc_now
    )

    user: Mapped["User"] = relationship(back_populates="wallet")
    transactions: Mapped[list["WalletTransaction"]] = relationship(
        back_populates="wallet",
    )
