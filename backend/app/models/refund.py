from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    JSON,
    Numeric,
    String,
)
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base, utc_now


class Refund(Base):
    __tablename__ = "refunds"

    __table_args__ = (
        CheckConstraint(
            "refund_status IN ('PENDING', 'SUCCESS', 'FAILED')",
            name="ck_refunds_refund_status",
        ),
        CheckConstraint("amount >= 0", name="ck_refunds_amount"),
        Index("ix_refunds_payment_id", "payment_id"),
        Index("ix_refunds_order_id", "order_id"),
        Index("ix_refunds_refund_status", "refund_status"),
    )

    id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        primary_key=True,
        autoincrement=True,
    )
    payment_id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("payments.id"),
        nullable=False,
    )
    order_id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("orders.id"),
        nullable=False,
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    reason: Mapped[str] = mapped_column(String(500), nullable=False)
    refund_status: Mapped[str] = mapped_column(String(30), nullable=False)
    gateway_response: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    refunded_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=utc_now,
    )

    payment: Mapped["Payment"] = relationship(back_populates="refunds")
    order: Mapped["Order"] = relationship(back_populates="refunds")
