from __future__ import annotations

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base, utc_now


class OrderStatusLog(Base):
    __tablename__ = "order_status_logs"

    __table_args__ = (
        CheckConstraint(
            "new_status IN "
            "('PLACED', 'READY_TO_SHIP', 'SHIPPING', 'COMPLETED', "
            "'DELIVERY_FAILED', 'CANCELLED')",
            name="ck_order_status_logs_new_status",
        ),
        CheckConstraint(
            "old_status IS NULL OR old_status IN "
            "('PLACED', 'READY_TO_SHIP', 'SHIPPING', 'COMPLETED', "
            "'DELIVERY_FAILED', 'CANCELLED')",
            name="ck_order_status_logs_old_status",
        ),
        Index("ix_order_status_logs_order_id", "order_id"),
        Index("ix_order_status_logs_new_status", "new_status"),
        Index("ix_order_status_logs_created_at", "created_at"),
    )

    id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        primary_key=True,
        autoincrement=True,
    )
    order_id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("orders.id"),
        nullable=False,
    )
    old_status: Mapped[str | None] = mapped_column(String(30), nullable=True)
    new_status: Mapped[str] = mapped_column(String(30), nullable=False)
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=utc_now,
    )

    order: Mapped["Order"] = relationship(back_populates="status_logs")
