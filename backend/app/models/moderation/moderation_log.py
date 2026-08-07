from __future__ import annotations

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base, utc_now


class ModerationLog(Base):
    __tablename__ = "moderation_logs"

    __table_args__ = (
        CheckConstraint(
            "action IN "
            "('HIDE_PRODUCT', 'DELETE_PRODUCT', 'LOCK_SELLER', 'REJECT_REPORT')",
            name="ck_moderation_logs_action",
        ),
        Index("ix_moderation_logs_report_id", "report_id"),
        Index("ix_moderation_logs_product_id", "product_id"),
        Index("ix_moderation_logs_seller_id", "seller_id"),
        Index("ix_moderation_logs_action", "action"),
        Index("ix_moderation_logs_created_at", "created_at"),
    )

    id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        primary_key=True,
        autoincrement=True,
    )
    report_id: Mapped[int | None] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("violation_reports.id"),
        nullable=True,
    )
    product_id: Mapped[int | None] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("products.id"),
        nullable=True,
    )
    seller_id: Mapped[int | None] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("seller_profiles.id"),
        nullable=True,
    )
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=utc_now,
    )

    report: Mapped["ViolationReport | None"] = relationship(
        back_populates="moderation_logs",
    )
    product: Mapped["Product | None"] = relationship(back_populates="moderation_logs")
    seller: Mapped["SellerProfile | None"] = relationship(
        back_populates="moderation_logs",
    )
