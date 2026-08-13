from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Numeric, String
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base, utc_now


class OrderItem(Base):
    __tablename__ = "order_items"

    __table_args__ = (
        CheckConstraint("unit_price >= 0", name="ck_order_items_unit_price"),
        CheckConstraint("quantity > 0", name="ck_order_items_quantity"),
        CheckConstraint("subtotal >= 0", name="ck_order_items_subtotal"),
        Index("ix_order_items_order_id", "order_id"),
        Index("ix_order_items_product_id", "product_id"),
        Index("ix_order_items_variant_id", "variant_id"),
    )

    id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        primary_key=True,
        autoincrement=True,
    )
    order_id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("orders.id"),
        nullable=False,
    )
    product_id: Mapped[int | None] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("products.id"),
        nullable=True,
    )
    variant_id: Mapped[int | None] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("product_variants.id"),
        nullable=True,
    )
    product_name_snapshot: Mapped[str] = mapped_column(String(255), nullable=False)
    variant_name_snapshot: Mapped[str] = mapped_column(String(150), nullable=False)
    product_image_snapshot: Mapped[str | None] = mapped_column(
        String(500),
        nullable=True,
    )
    seller_name_snapshot: Mapped[str] = mapped_column(String(150), nullable=False)
    sku_snapshot: Mapped[str | None] = mapped_column(String(255), nullable=True)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    original_price_snapshot: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2), nullable=True
    )
    quantity: Mapped[int] = mapped_column(mysql.INTEGER(unsigned=True), nullable=False)
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=utc_now,
    )

    order: Mapped["Order"] = relationship(back_populates="items")
    product: Mapped["Product | None"] = relationship(back_populates="order_items")
    variant: Mapped["ProductVariant | None"] = relationship(
        back_populates="order_items"
    )
    review: Mapped["ProductReview | None"] = relationship(
        back_populates="order_item",
        uselist=False,
    )

    @property
    def is_reviewed(self) -> bool:
        if hasattr(self, "__dict__") and "review" in self.__dict__:
            return self.__dict__["review"] is not None
        return False

    @property
    def product_slug(self) -> str | None:
        if hasattr(self, "__dict__") and "product" in self.__dict__ and self.product:
            return self.product.slug
        return None
