from __future__ import annotations

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base, utc_now


class SearchLog(Base):
    __tablename__ = "search_logs"

    __table_args__ = (
        CheckConstraint(
            "result_count IS NULL OR result_count >= 0",
            name="ck_search_logs_result_count",
        ),
        Index("ix_search_logs_user_id", "user_id"),
        Index("ix_search_logs_keyword", "keyword"),
        Index("ix_search_logs_created_at", "created_at"),
    )

    id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        primary_key=True,
        autoincrement=True,
    )
    user_id: Mapped[int | None] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("users.id"),
        nullable=True,
    )
    keyword: Mapped[str] = mapped_column(String(255), nullable=False)
    result_count: Mapped[int | None] = mapped_column(
        mysql.INTEGER(unsigned=True),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=utc_now,
    )

    user: Mapped["User | None"] = relationship(back_populates="search_logs")
