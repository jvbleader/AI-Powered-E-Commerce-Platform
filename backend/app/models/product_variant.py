from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    CHAR,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    text,
)
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base, new_public_id, utc_now


class ProductVariant(Base):
    __tablename__ = "product_variants"

    __table_args__ = (
        CheckConstraint(
            "status IN ('ACTIVE', 'HIDDEN', 'OUT_OF_STOCK', 'DELETED')",
            name="ck_product_variants_status",
        ),
        CheckConstraint("price >= 0", name="ck_product_variants_price"),
        CheckConstraint(
            "sale_price IS NULL OR sale_price >= 0",
            name="ck_product_variants_sale_price",
        ),
        Index("ix_product_variants_product_id", "product_id"),
        Index("ix_product_variants_sku", "sku"),
        Index("ix_product_variants_status", "status"),
        Index("ix_product_variants_price", "price"),
        Index("ix_product_variants_sale_price", "sale_price"),
    )

    id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        primary_key=True,
        autoincrement=True,
    )
    public_id: Mapped[str] = mapped_column(
        CHAR(36),
        unique=True,
        nullable=False,
        default=new_public_id,
    )
    product_id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("products.id"),
        nullable=False,
    )
    sku: Mapped[str] = mapped_column(String(100), nullable=False)
    variant_name: Mapped[str] = mapped_column(String(150), nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    sale_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    sale_start_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    sale_end_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="ACTIVE",
        server_default=text("'ACTIVE'"),
    )
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=utc_now,
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime,
        nullable=True,
        onupdate=utc_now,
    )

    product: Mapped["Product"] = relationship(back_populates="variants")
    inventory: Mapped["Inventory | None"] = relationship(
        back_populates="variant",
        cascade="all, delete-orphan",
        uselist=False,
    )
    inventory_transactions: Mapped[list["InventoryTransaction"]] = relationship(
        back_populates="variant",
    )
    cart_items: Mapped[list["CartItem"]] = relationship(back_populates="variant")
    order_items: Mapped[list["OrderItem"]] = relationship(back_populates="variant")
