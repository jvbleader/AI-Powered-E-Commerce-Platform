from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Numeric
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base, utc_now


class PaymentOrder(Base):
    __tablename__ = "payment_orders"

    __table_args__ = (
        CheckConstraint("amount >= 0", name="ck_payment_orders_amount"),
        Index("ix_payment_orders_payment_id", "payment_id"),
        Index("ix_payment_orders_order_id", "order_id"),
    )

    payment_id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("payments.id"),
        primary_key=True,
    )
    order_id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("orders.id"),
        primary_key=True,
        unique=True,
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=utc_now,
    )

    payment: Mapped["Payment"] = relationship(back_populates="order_links")
    order: Mapped["Order"] = relationship(back_populates="payment_order")
