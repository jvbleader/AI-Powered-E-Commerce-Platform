from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    CHAR,
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

from models.base import Base, new_public_id, utc_now


class Payment(Base):
    __tablename__ = "payments"

    __table_args__ = (
        CheckConstraint(
            "payment_method IN ('BANK', 'MOMO', 'CREDIT_CARD', 'MOCK', 'VNPAY')",
            name="ck_payments_payment_method",
        ),
        CheckConstraint(
            "payment_status IN "
            "('PENDING', 'PAID', 'FAILED', 'CANCELLED', "
            "'REFUND_PENDING', 'REFUNDED')",
            name="ck_payments_payment_status",
        ),
        CheckConstraint("amount >= 0", name="ck_payments_amount"),
        Index("ix_payments_user_id", "user_id"),
        Index("ix_payments_payment_status", "payment_status"),
        Index("ix_payments_payment_method", "payment_method"),
        Index("ix_payments_created_at", "created_at"),
    )

    id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        primary_key=True,
        autoincrement=True,
    )
    public_id: Mapped[str] = mapped_column(
        CHAR(36),
        unique=True,
        nullable=False,
        default=new_public_id,
    )
    payment_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    user_id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("users.id"),
        nullable=False,
    )
    payment_method: Mapped[str] = mapped_column(String(50), nullable=False)
    payment_gateway: Mapped[str | None] = mapped_column(String(50), nullable=True)
    payment_status: Mapped[str] = mapped_column(String(30), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    transaction_code: Mapped[str | None] = mapped_column(
        String(100),
        unique=True,
        nullable=True,
    )
    gateway_response: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    failed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
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

    user: Mapped["User"] = relationship(back_populates="payments")
    order_links: Mapped[list["PaymentOrder"]] = relationship(
        back_populates="payment",
        cascade="all, delete-orphan",
    )
    refunds: Mapped[list["Refund"]] = relationship(back_populates="payment")

    @property
    def order_codes(self) -> list[str]:
        return [link.order.order_code for link in self.order_links if link.order]
