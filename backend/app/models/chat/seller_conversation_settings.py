from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, UniqueConstraint
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base, utc_now

if TYPE_CHECKING:
    from models.chat.seller_chat import SellerConversation
    from models.user import User


class SellerConversationUserSettings(Base):
    __tablename__ = "seller_conversation_user_settings"

    __table_args__ = (
        UniqueConstraint("conversation_id", "user_id", name="uq_seller_conv_user_settings"),
        Index("ix_seller_conv_settings_user_id", "user_id"),
    )

    id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        primary_key=True,
        autoincrement=True,
    )
    conversation_id: Mapped[str] = mapped_column(
        ForeignKey("seller_conversations.id", ondelete="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    is_pinned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_muted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_hidden: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    marked_unread: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
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

    conversation: Mapped["SellerConversation"] = relationship(
        "SellerConversation",
        foreign_keys=[conversation_id],
    )
    user: Mapped["User"] = relationship("User", foreign_keys=[user_id])
