from __future__ import annotations

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, String
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base, utc_now


class InventoryTransaction(Base):
    __tablename__ = "inventory_transactions"

    __table_args__ = (
        CheckConstraint(
            "transaction_type IN "
            "('IMPORT', 'ORDER_RESERVE', 'ORDER_DEDUCT', 'CANCEL_RELEASE', 'ADJUST')",
            name="ck_inventory_transactions_transaction_type",
        ),
        CheckConstraint(
            "quantity_before >= 0",
            name="ck_inventory_transactions_quantity_before",
        ),
        CheckConstraint(
            "quantity_after >= 0",
            name="ck_inventory_transactions_quantity_after",
        ),
        Index("ix_inventory_transactions_variant_id", "variant_id"),
        Index("ix_inventory_transactions_transaction_type", "transaction_type"),
        Index("ix_inventory_transactions_created_at", "created_at"),
    )

    id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        primary_key=True,
        autoincrement=True,
    )
    variant_id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("product_variants.id"),
        nullable=False,
    )
    transaction_type: Mapped[str] = mapped_column(String(30), nullable=False)
    quantity_change: Mapped[int] = mapped_column(mysql.INTEGER(), nullable=False)
    quantity_before: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True),
        nullable=False,
    )
    quantity_after: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True),
        nullable=False,
    )
    reference_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    reference_id: Mapped[int | None] = mapped_column(
        mysql.BIGINT(unsigned=True),
        nullable=True,
    )
    note: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=utc_now,
    )

    variant: Mapped["ProductVariant"] = relationship(
        back_populates="inventory_transactions",
    )
