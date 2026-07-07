from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Numeric, String
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base, utc_now


class SellerPayout(Base):
    __tablename__ = "seller_payouts"

    __table_args__ = (
        CheckConstraint(
            "payout_status IN ('PENDING', 'PROCESSING', 'PAID', 'FAILED')",
            name="ck_seller_payouts_payout_status",
        ),
        CheckConstraint("amount >= 0", name="ck_seller_payouts_amount"),
        Index("ix_seller_payouts_seller_id", "seller_id"),
        Index("ix_seller_payouts_payout_status", "payout_status"),
        Index("ix_seller_payouts_created_at", "created_at"),
    )

    id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        primary_key=True,
        autoincrement=True,
    )
    seller_id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("seller_profiles.id"),
        nullable=False,
    )
    order_id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("orders.id"),
        unique=True,
        nullable=False,
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    payout_status: Mapped[str] = mapped_column(String(30), nullable=False)
    bank_account_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    bank_account_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    bank_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
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

    seller: Mapped["SellerProfile"] = relationship(back_populates="payouts")
    order: Mapped["Order"] = relationship(back_populates="payout")
