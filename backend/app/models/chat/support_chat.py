from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CHAR, DateTime, ForeignKey, Index, String, Text, Enum
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base, new_public_id, utc_now

if TYPE_CHECKING:
    from models.user import User


class SupportConversation(Base):
    __tablename__ = "support_conversations"

    __table_args__ = (
        Index("ix_support_conversations_customer_id", "customer_id"),
        Index("ix_support_conversations_guest_id", "guest_id"),
        Index("ix_support_conversations_supporter_id", "supporter_id"),
        Index("ix_support_conversations_status", "status"),
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
    guest_id: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    supporter_id: Mapped[int | None] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("users.id", ondelete="SET NULL"),
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
    supporter: Mapped[User | None] = relationship(
        "User", foreign_keys=[supporter_id]
    )
    messages: Mapped[list[SupportMessage]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        order_by="SupportMessage.created_at.asc()",
    )


class SupportMessage(Base):
    __tablename__ = "support_messages"

    __table_args__ = (
        Index("ix_support_messages_conversation_id", "conversation_id"),
    )

    id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        primary_key=True,
        autoincrement=True,
    )
    conversation_id: Mapped[str] = mapped_column(
        CHAR(36),
        ForeignKey("support_conversations.id", ondelete="CASCADE"),
        nullable=False,
    )
    sender_type: Mapped[str] = mapped_column(
        Enum("CUSTOMER", "SUPPORTER", "SYSTEM"),
        nullable=False,
    )
    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )
    attachment_type: Mapped[str | None] = mapped_column(
        Enum("IMAGE", "VIDEO", "FILE"),
        nullable=True,
    )
    attachment_id: Mapped[str | None] = mapped_column(
        String(512),
        nullable=True,
    )
    attachments: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=utc_now,
    )

    conversation: Mapped[SupportConversation] = relationship(back_populates="messages")
