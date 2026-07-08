from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base, utc_now


class ViolationReport(Base):
    __tablename__ = "violation_reports"

    __table_args__ = (
        CheckConstraint(
            "status IN ('PENDING', 'REVIEWING', 'RESOLVED', 'REJECTED')",
            name="ck_violation_reports_status",
        ),
        UniqueConstraint(
            "reporter_id",
            "product_id",
            name="uq_violation_reports_reporter_product",
        ),
        Index("ix_violation_reports_product_id", "product_id"),
        Index("ix_violation_reports_status", "status"),
        Index("ix_violation_reports_created_at", "created_at"),
    )

    id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        primary_key=True,
        autoincrement=True,
    )
    reporter_id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("users.id"),
        nullable=False,
    )
    product_id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("products.id"),
        nullable=False,
    )
    reason_type: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="PENDING",
        server_default=text("'PENDING'"),
    )
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=utc_now,
    )

    reporter: Mapped["User"] = relationship(back_populates="violation_reports")
    product: Mapped["Product"] = relationship(back_populates="violation_reports")
    images: Mapped[list["ViolationReportImage"]] = relationship(
        back_populates="report",
        cascade="all, delete-orphan",
    )
    moderation_logs: Mapped[list["ModerationLog"]] = relationship(
        back_populates="report",
    )
