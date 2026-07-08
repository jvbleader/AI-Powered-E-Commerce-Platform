from __future__ import annotations

from decimal import Decimal

from sqlalchemy import CheckConstraint, ForeignKey, Numeric, text
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base


class SellerStatistics(Base):
    __tablename__ = "seller_statistics"

    __table_args__ = (
        CheckConstraint("total_sold >= 0", name="ck_seller_statistics_total_sold"),
        CheckConstraint(
            "total_revenue >= 0", name="ck_seller_statistics_total_revenue"
        ),
    )

    id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        primary_key=True,
        autoincrement=True,
    )
    seller_id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("seller_profiles.id"),
        unique=True,
        nullable=False,
    )
    total_sold: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True),
        nullable=False,
        default=0,
        server_default=text("0"),
    )
    total_revenue: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        nullable=False,
        default=Decimal("0.00"),
        server_default=text("0.00"),
    )

    seller: Mapped["SellerProfile"] = relationship(back_populates="statistics")
