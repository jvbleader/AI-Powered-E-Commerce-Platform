from __future__ import annotations

from sqlalchemy import ForeignKey, Index
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base


class ProductCategory(Base):
    __tablename__ = "product_categories"

    __table_args__ = (Index("ix_product_categories_category_id", "category_id"),)

    product_id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("products.id"),
        primary_key=True,
    )
    category_id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("categories.id"),
        primary_key=True,
    )

    product: Mapped["Product"] = relationship(back_populates="product_categories")
    category: Mapped["Category"] = relationship(back_populates="product_categories")
