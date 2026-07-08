from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, Index, Numeric, String, text
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base, utc_now


class Coupon(Base):
    __tablename__ = "coupons"

    __table_args__ = (
        CheckConstraint(
            "coupon_type IN ('ORDER_DISCOUNT', 'SHIPPING_DISCOUNT')",
            name="ck_coupons_coupon_type",
        ),
        CheckConstraint(
            "discount_type IN ('PERCENT', 'FIXED_AMOUNT')",
            name="ck_coupons_discount_type",
        ),
        CheckConstraint(
            "status IN ('ACTIVE', 'INACTIVE', 'EXPIRED')",
            name="ck_coupons_status",
        ),
        CheckConstraint("discount_value >= 0", name="ck_coupons_discount_value"),
        CheckConstraint(
            "max_discount_amount IS NULL OR max_discount_amount >= 0",
            name="ck_coupons_max_discount_amount",
        ),
        CheckConstraint(
            "min_order_amount IS NULL OR min_order_amount >= 0",
            name="ck_coupons_min_order_amount",
        ),
        CheckConstraint("usage_limit >= 0", name="ck_coupons_usage_limit"),
        CheckConstraint("used_count >= 0", name="ck_coupons_used_count"),
        Index("ix_coupons_coupon_type", "coupon_type"),
        Index("ix_coupons_status", "status"),
        Index("ix_coupons_start_at", "start_at"),
        Index("ix_coupons_end_at", "end_at"),
    )

    id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        primary_key=True,
        autoincrement=True,
    )
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    coupon_type: Mapped[str] = mapped_column(String(30), nullable=False)
    discount_type: Mapped[str] = mapped_column(String(30), nullable=False)
    discount_value: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    max_discount_amount: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2),
        nullable=True,
    )
    min_order_amount: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2),
        nullable=True,
    )
    usage_limit: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True),
        nullable=False,
    )
    used_count: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True),
        nullable=False,
        default=0,
        server_default=text("0"),
    )
    start_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False)
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

    usages: Mapped[list["CouponUsage"]] = relationship(back_populates="coupon")
