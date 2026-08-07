from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CHAR, DateTime, ForeignKey, Index, String, Text, Enum
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base, new_public_id, utc_now

if TYPE_CHECKING:
    from models.seller import SellerProfile
    from models.user import User


class SellerConversation(Base):
    __tablename__ = "seller_conversations"

    __table_args__ = (
        Index("ix_seller_conversations_customer_id", "customer_id"),
        Index("ix_seller_conversations_shop_id", "shop_id"),
        Index("ix_seller_conversations_status", "status"),
    )

    id: Mapped[str] = mapped_column(
        CHAR(36),
        primary_key=True,
        default=new_public_id,
    )
    customer_id: Mapped[int | None] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    shop_id: Mapped[int | None] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("seller_profiles.id", ondelete="CASCADE"),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(
        Enum("OPEN", "CLOSED"),
        nullable=False,
        default="OPEN",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=utc_now,
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
        default=utc_now,
        onupdate=utc_now,
    )

    customer: Mapped[User | None] = relationship(
        "User", foreign_keys=[customer_id]
    )
    shop: Mapped[SellerProfile | None] = relationship(
        "SellerProfile", foreign_keys=[shop_id]
    )
    messages: Mapped[list[SellerMessage]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="SellerMessage.created_at.asc()",
    )


class SellerMessage(Base):
    __tablename__ = "seller_messages"

    __table_args__ = (
        Index("ix_seller_messages_conversation_id", "conversation_id"),
    )

    id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        primary_key=True,
        autoincrement=True,
    )
    conversation_id: Mapped[str] = mapped_column(
        CHAR(36),
        ForeignKey("seller_conversations.id", ondelete="CASCADE"),
        nullable=False,
    )
    sender_type: Mapped[str] = mapped_column(
        Enum("CUSTOMER", "SELLER", "SYSTEM"),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    attachment_type: Mapped[str | None] = mapped_column(
        Enum("PRODUCT", "ORDER", "IMAGE", "VIDEO"),
        nullable=True,
    )
    attachment_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=utc_now,
    )
    reply_to_id: Mapped[int | None] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("seller_messages.id", ondelete="SET NULL"),
        nullable=True,
    )
    status: Mapped[str] = mapped_column(
        Enum("SENT", "DELIVERED", "READ"),
        nullable=False,
        default="SENT",
        server_default="SENT",
    )

    conversation: Mapped[SellerConversation] = relationship(back_populates="messages")
    reply_to: Mapped["SellerMessage | None"] = relationship(remote_side="[SellerMessage.id]")
