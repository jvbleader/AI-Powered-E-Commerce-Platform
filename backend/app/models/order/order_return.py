from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    CHAR,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    JSON,
    String,
    Text,
    text,
)
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base, new_public_id, utc_now

if TYPE_CHECKING:
    from models.order.order import Order
    from models.seller.seller_profile import SellerProfile
    from models.user.user import User


class OrderReturn(Base):
    __tablename__ = "order_returns"

    __table_args__ = (
        CheckConstraint(
            "return_status IN ('REQUESTED', 'SELLER_APPROVED', 'RETURNING', "
            "'COMPLETED', 'SELLER_REJECTED', 'DISPUTED', 'SUPPORT_APPROVED', 'SUPPORT_REJECTED')",
            name="ck_order_returns_status",
        ),
        Index("ix_order_returns_order_id", "order_id"),
        Index("ix_order_returns_user_id", "user_id"),
        Index("ix_order_returns_seller_id", "seller_id"),
        Index("ix_order_returns_return_status", "return_status"),
        Index("ix_order_returns_created_at", "created_at"),
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
    return_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    order_id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("orders.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
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
    return_status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="REQUESTED",
        server_default=text("'REQUESTED'"),
    )
    reason: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    evidence_images: Mapped[list[str] | list[Any] | None] = mapped_column(
        JSON,
        nullable=True,
    )
    seller_reject_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    seller_responded_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )
    return_shipping_provider: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )
    return_tracking_code: Mapped[str | None] = mapped_column(
        String(50),
        nullable=True,
    )
    pickup_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    return_address: Mapped[str | None] = mapped_column(Text, nullable=True)
    dispute_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    disputed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    supporter_id: Mapped[int | None] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("users.id"),
        nullable=True,
    )
    supporter_decision: Mapped[str | None] = mapped_column(String(30), nullable=True)
    supporter_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
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

    order: Mapped["Order"] = relationship(back_populates="return_request")
    user: Mapped["User"] = relationship(foreign_keys=[user_id])
    seller: Mapped["SellerProfile"] = relationship(foreign_keys=[seller_id])
    supporter: Mapped["User | None"] = relationship(foreign_keys=[supporter_id])
