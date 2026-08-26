from __future__ import annotations

from datetime import date, datetime
from typing import TYPE_CHECKING

from sqlalchemy import (
    CHAR,
    CheckConstraint,
    Date,
    DateTime,
    Index,
    String,
)
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base, new_public_id, utc_now

if TYPE_CHECKING:
    from models.cart import Cart
    from models.catalog import ProductReview
    from models.chat import ChatSession
    from models.engagement import Notification, SearchLog
    from models.moderation import ViolationReport
    from models.order import Order, OrderCancellation
    from models.payment import Payment
    from models.seller import SellerProfile
    from models.wallet import Wallet
    from .user_address import UserAddress
    from .user_role import UserRole


class User(Base):
    __tablename__ = "users"

    __table_args__ = (
        CheckConstraint(
            "status IN ('ACTIVE', 'LOCKED', 'DELETED')",
            name="ck_users_status",
        ),
        CheckConstraint(
            "gender IS NULL OR gender IN ('MALE', 'FEMALE', 'OTHER')",
            name="ck_users_gender",
        ),
        Index("ix_users_status", "status"),
        Index("ix_users_created_at", "created_at"),
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
    full_name: Mapped[str] = mapped_column(String(150), nullable=False)
    user_name: Mapped[str] = mapped_column(String(40), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    phone: Mapped[str] = mapped_column(String(20), unique=True, nullable=False)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    gender: Mapped[str | None] = mapped_column(String(20), nullable=True)
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    email_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )
    phone_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
    )
    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="ACTIVE",
    )
    locked_until: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    lock_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
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

    roles: Mapped[list["UserRole"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    addresses: Mapped[list["UserAddress"]] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
    )
    seller_profile: Mapped["SellerProfile | None"] = relationship(
        back_populates="user",
        uselist=False,
    )
    wallet: Mapped["Wallet | None"] = relationship(
        back_populates="user",
        uselist=False,
    )
    cart: Mapped["Cart | None"] = relationship(
        back_populates="user",
        cascade="all, delete-orphan",
        uselist=False,
    )
    orders: Mapped[list["Order"]] = relationship(back_populates="user")
    payments: Mapped[list["Payment"]] = relationship(back_populates="user")
    product_reviews: Mapped[list["ProductReview"]] = relationship(back_populates="user")
    violation_reports: Mapped[list["ViolationReport"]] = relationship(
        back_populates="reporter",
    )
    order_cancellations: Mapped[list["OrderCancellation"]] = relationship(
        back_populates="cancelled_by_user",
    )
    notifications: Mapped[list["Notification"]] = relationship(
        back_populates="recipient",
    )
    search_logs: Mapped[list["SearchLog"]] = relationship(back_populates="user")
    chat_sessions: Mapped[list["ChatSession"]] = relationship(
        back_populates="user",
    )
