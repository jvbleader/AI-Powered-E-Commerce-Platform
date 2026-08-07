from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base, utc_now


class CouponUsage(Base):
    __tablename__ = "coupon_usages"

    __table_args__ = (
        CheckConstraint(
            "coupon_type_snapshot IN ('ORDER_DISCOUNT', 'SHIPPING_DISCOUNT')",
            name="ck_coupon_usages_coupon_type_snapshot",
        ),
        CheckConstraint("discount_amount >= 0", name="ck_coupon_usages_discount"),
        UniqueConstraint("user_id", "coupon_id", name="uq_coupon_usages_user_coupon"),
        UniqueConstraint(
            "order_id",
            "coupon_type_snapshot",
            name="uq_coupon_usages_order_type",
        ),
        Index("ix_coupon_usages_order_id", "order_id"),
        Index("ix_coupon_usages_coupon_id", "coupon_id"),
    )

    id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        primary_key=True,
        autoincrement=True,
    )
    coupon_id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("coupons.id"),
        nullable=False,
    )
    user_id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("users.id"),
        nullable=False,
    )
    order_id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("orders.id"),
        nullable=False,
    )
    coupon_type_snapshot: Mapped[str] = mapped_column(String(30), nullable=False)
    discount_amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    used_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=utc_now,
    )

    coupon: Mapped["Coupon"] = relationship(back_populates="usages")
    user: Mapped["User"] = relationship(back_populates="coupon_usages")
    order: Mapped["Order"] = relationship(back_populates="coupon_usages")
