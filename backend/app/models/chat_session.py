from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import CHAR, DateTime, ForeignKey, Index, String
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base, new_public_id, utc_now

if TYPE_CHECKING:
    from models.chat_message import ChatMessage
    from models.user import User


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    __table_args__ = (
        Index("ix_chat_sessions_user_id", "user_id"),
        Index("ix_chat_sessions_session_token", "session_token"),
    )

    id: Mapped[str] = mapped_column(
        CHAR(36),
        primary_key=True,
        default=new_public_id,
    )
    user_id: Mapped[int | None] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    session_token: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
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

    user: Mapped[User | None] = relationship(back_populates="chat_sessions")
    messages: Mapped[list[ChatMessage]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="ChatMessage.created_at.asc()",
    )
