from __future__ import annotations

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base, utc_now


class OrderCancellation(Base):
    __tablename__ = "order_cancellations"

    __table_args__ = (
        CheckConstraint(
            "cancelled_by_type IN ('CUSTOMER', 'SELLER', 'SYSTEM')",
            name="ck_order_cancellations_cancelled_by_type",
        ),
    )

    id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        primary_key=True,
        autoincrement=True,
    )
    order_id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("orders.id"),
        unique=True,
        nullable=False,
    )
    cancelled_by_user_id: Mapped[int | None] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("users.id"),
        nullable=True,
    )
    cancelled_by_type: Mapped[str] = mapped_column(String(30), nullable=False)
    reason: Mapped[str] = mapped_column(String(500), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=utc_now,
    )

    order: Mapped["Order"] = relationship(back_populates="cancellation")
    cancelled_by_user: Mapped["User | None"] = relationship(
        back_populates="order_cancellations",
    )
