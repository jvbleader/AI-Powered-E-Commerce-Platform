from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, Numeric
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base, utc_now


class PlatformFinanceSummary(Base):
    __tablename__ = "platform_finance_summary"

    __table_args__ = (
        CheckConstraint("escrow_holding_balance >= 0", name="ck_platform_finance_escrow_holding"),
        CheckConstraint("total_shipping_fee_held >= 0", name="ck_platform_finance_shipping_held"),
        CheckConstraint("total_platform_revenue >= 0", name="ck_platform_finance_revenue"),
        CheckConstraint("total_commission_fee_collected >= 0", name="ck_platform_finance_comm_fee"),
        CheckConstraint("total_payment_fee_collected >= 0", name="ck_platform_finance_pay_fee"),
        CheckConstraint("total_seller_balances >= 0", name="ck_platform_finance_seller_balances"),
        CheckConstraint("total_payouts_disbursed >= 0", name="ck_platform_finance_payouts_disbursed"),
        CheckConstraint("total_refunded_amount >= 0", name="ck_platform_finance_refunded"),
    )

    id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        primary_key=True,
        autoincrement=True,
    )
    escrow_holding_balance: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=Decimal("0.00"),
    )
    total_shipping_fee_held: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=Decimal("0.00"),
    )
    total_platform_revenue: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=Decimal("0.00"),
    )
    total_commission_fee_collected: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=Decimal("0.00"),
    )
    total_payment_fee_collected: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=Decimal("0.00"),
    )
    total_seller_balances: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=Decimal("0.00"),
    )
    total_payouts_disbursed: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=Decimal("0.00"),
    )
    total_refunded_amount: Mapped[Decimal] = mapped_column(
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
