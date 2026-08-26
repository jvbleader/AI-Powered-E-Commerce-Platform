from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, List

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Numeric
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base, utc_now

if TYPE_CHECKING:
    from models.seller.seller_profile import SellerProfile
    from models.seller.seller_wallet_transaction import SellerWalletTransaction


class SellerWallet(Base):
    __tablename__ = "seller_wallets"

    __table_args__ = (
        CheckConstraint("available_balance >= 0", name="ck_seller_wallets_available_balance"),
        CheckConstraint("pending_balance >= 0", name="ck_seller_wallets_pending_balance"),
        CheckConstraint("total_withdrawn >= 0", name="ck_seller_wallets_total_withdrawn"),
        Index("ix_seller_wallets_seller_id", "seller_id"),
    )

    id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        primary_key=True,
        autoincrement=True,
    )
    seller_id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("seller_profiles.id"),
        unique=True,
        nullable=False,
    )
    available_balance: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=Decimal("0.00"),
    )
    pending_balance: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=Decimal("0.00"),
    )
    total_withdrawn: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=Decimal("0.00"),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=utc_now,
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
        onupdate=utc_now,
    )

    seller: Mapped["SellerProfile"] = relationship(back_populates="wallet")
    transactions: Mapped[List["SellerWalletTransaction"]] = relationship(
        back_populates="wallet",
        cascade="all, delete-orphan",
        order_by="desc(SellerWalletTransaction.created_at)",
    )
