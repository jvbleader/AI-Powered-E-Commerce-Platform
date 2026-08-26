from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base, utc_now

if TYPE_CHECKING:
    from models.user import User


class TrafficLog(Base):
    __tablename__ = "traffic_logs"

    __table_args__ = (
        Index("ix_traffic_logs_created_at", "created_at"),
        Index("ix_traffic_logs_source_channel", "source_channel"),
        Index("ix_traffic_logs_device_type", "device_type"),
        Index("ix_traffic_logs_user_id", "user_id"),
        Index("ix_traffic_logs_session_id", "session_id"),
    )

    id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        primary_key=True,
        autoincrement=True,
    )
    user_id: Mapped[int | None] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    session_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    path: Mapped[str] = mapped_column(String(255), nullable=False)
    referrer: Mapped[str | None] = mapped_column(String(500), nullable=True)
    source_channel: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="DIRECT",
    )  # DIRECT, ORGANIC_SEARCH, SOCIAL, REFERRAL, ADS
    device_type: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        default="DESKTOP",
    )  # MOBILE, DESKTOP, TABLET
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=utc_now,
    )

    user: Mapped["User | None"] = relationship()
