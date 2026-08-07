from __future__ import annotations

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String, text
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base, utc_now


class CategorySuggestion(Base):
    __tablename__ = "category_suggestions"

    __table_args__ = (
        CheckConstraint(
            "status IN ('PENDING', 'APPROVED', 'REJECTED')",
            name="ck_category_suggestions_status",
        ),
        Index("ix_category_suggestions_seller_id", "seller_id"),
        Index("ix_category_suggestions_status", "status"),
    )

    id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        primary_key=True,
        autoincrement=True,
    )
    seller_id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("seller_profiles.id"),
        nullable=False,
    )
    suggested_name: Mapped[str] = mapped_column(String(150), nullable=False)
    reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="PENDING",
        server_default=text("'PENDING'"),
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=utc_now,
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    seller: Mapped["SellerProfile"] = relationship(
        back_populates="category_suggestions",
    )
