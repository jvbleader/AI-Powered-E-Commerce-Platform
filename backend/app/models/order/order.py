from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    CHAR,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    text,
)
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base, new_public_id, utc_now


class Order(Base):
    __tablename__ = "orders"

    __table_args__ = (
        CheckConstraint(
            "order_status IN "
            "('PLACED', 'READY_TO_SHIP', 'SHIPPING', 'DELIVERED', 'COMPLETED', "
            "'DELIVERY_FAILED', 'CANCELLED', 'RETURNED')",
            name="ck_orders_order_status",
        ),
        CheckConstraint(
            "payment_status IN "
            "('PENDING', 'PAID', 'FAILED', 'CANCELLED', "
            "'REFUND_PENDING', 'REFUNDED')",
            name="ck_orders_payment_status",
        ),
        CheckConstraint("subtotal_amount >= 0", name="ck_orders_subtotal_amount"),
        CheckConstraint("shipping_fee >= 0", name="ck_orders_shipping_fee"),
        CheckConstraint("total_amount >= 0", name="ck_orders_total_amount"),
        Index("ix_orders_user_id", "user_id"),
        Index("ix_orders_seller_id", "seller_id"),
        Index("ix_orders_order_status", "order_status"),
        Index("ix_orders_payment_status", "payment_status"),
        Index("ix_orders_created_at", "created_at"),
        Index("ix_orders_payment_expires_at", "payment_expires_at"),
        Index("ix_orders_seller_confirm_expires_at", "seller_confirm_expires_at"),
        Index("ix_orders_auto_complete_at", "auto_complete_at"),
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
    order_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    user_id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("users.id"),
        nullable=False,
    )
    seller_id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("seller_profiles.id"),
        nullable=False,
    )
    order_status: Mapped[str] = mapped_column(String(30), nullable=False)
    payment_status: Mapped[str] = mapped_column(String(30), nullable=False)
    seller_confirmed: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=text("0"),
    )
    seller_confirmed_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )
    subtotal_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    shipping_fee: Mapped[Decimal] = mapped_column(
        Numeric(12, 2),
        nullable=False,
        default=Decimal("0.00"),
        server_default=text("0.00"),
    )
    total_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    customer_note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    preferred_payment_method: Mapped[str | None] = mapped_column(String(50), nullable=True)
    print_count: Mapped[int] = mapped_column(
        mysql.INTEGER,
        nullable=False,
        default=0,
        server_default=text("0"),
    )
    payment_expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    seller_confirm_expires_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    auto_complete_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    return_tag: Mapped[str | None] = mapped_column(String(40), nullable=True)
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

    user: Mapped["User"] = relationship(back_populates="orders")
    seller: Mapped["SellerProfile"] = relationship(back_populates="orders")
    items: Mapped[list["OrderItem"]] = relationship(
        back_populates="order",
        cascade="all, delete-orphan",
    )
    shipment: Mapped["Shipment | None"] = relationship(
        back_populates="order",
        cascade="all, delete-orphan",
        uselist=False,
    )
    status_logs: Mapped[list["OrderStatusLog"]] = relationship(
        back_populates="order",
        cascade="all, delete-orphan",
    )
    cancellation: Mapped["OrderCancellation | None"] = relationship(
        back_populates="order",
        cascade="all, delete-orphan",
        uselist=False,
    )
    return_request: Mapped["OrderReturn | None"] = relationship(
        back_populates="order",
        cascade="all, delete-orphan",
        uselist=False,
    )
    payment_order: Mapped["PaymentOrder | None"] = relationship(
        back_populates="order",
        uselist=False,
    )
    refunds: Mapped[list["Refund"]] = relationship(back_populates="order")
    payout: Mapped["SellerPayout | None"] = relationship(
        back_populates="order",
        uselist=False,
    )
