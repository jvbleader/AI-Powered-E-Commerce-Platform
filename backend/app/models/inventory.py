from __future__ import annotations

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, text
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base, utc_now


class Inventory(Base):
    __tablename__ = "inventories"

    __table_args__ = (
        CheckConstraint("quantity >= 0", name="ck_inventories_quantity"),
        CheckConstraint(
            "reserved_quantity >= 0",
            name="ck_inventories_reserved_quantity",
        ),
    )

    id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        primary_key=True,
        autoincrement=True,
    )
    variant_id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("product_variants.id"),
        unique=True,
        nullable=False,
    )
    quantity: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True),
        nullable=False,
        default=0,
        server_default=text("0"),
    )
    reserved_quantity: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True),
        nullable=False,
        default=0,
        server_default=text("0"),
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
        default=utc_now,
        onupdate=utc_now,
    )

    variant: Mapped["ProductVariant"] = relationship(back_populates="inventory")
