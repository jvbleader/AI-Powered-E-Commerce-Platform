from __future__ import annotations

from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    CHAR,
    JSON,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base, new_public_id, utc_now


class Product(Base):
    __tablename__ = "products"

    __table_args__ = (
        CheckConstraint(
            "status IN ('ACTIVE', 'HIDDEN', 'OUT_OF_STOCK', 'DELETED')",
            name="ck_products_status",
        ),
        CheckConstraint("average_rating >= 0", name="ck_products_average_rating_min"),
        CheckConstraint("average_rating <= 5", name="ck_products_average_rating_max"),
        CheckConstraint("review_count >= 0", name="ck_products_review_count"),
        CheckConstraint("sold_count >= 0", name="ck_products_sold_count"),
        UniqueConstraint("seller_id", "slug", name="uq_products_seller_id_slug"),
        Index("ix_products_seller_id", "seller_id"),
        Index("ix_products_status", "status"),
        Index("ix_products_created_at", "created_at"),
        Index("ix_products_sold_count", "sold_count"),
        Index("ix_products_average_rating", "average_rating"),
        Index(
            "ix_products_fulltext_search",
            "name",
            "short_description",
            "description",
            mysql_prefix="FULLTEXT",
        ),
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
    seller_id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("seller_profiles.id"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    slug: Mapped[str] = mapped_column(String(280), nullable=False)
    short_description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    brand: Mapped[str | None] = mapped_column(String(120), nullable=True)
    origin: Mapped[str | None] = mapped_column(String(120), nullable=True)
    warranty_info: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="ACTIVE",
        server_default=text("'ACTIVE'"),
    )
    average_rating: Mapped[Decimal] = mapped_column(
        Numeric(3, 2),
        nullable=False,
        default=Decimal("0.00"),
        server_default=text("0.00"),
    )
    review_count: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True),
        nullable=False,
        default=0,
        server_default=text("0"),
    )
    sold_count: Mapped[int] = mapped_column(
        mysql.INTEGER(unsigned=True),
        nullable=False,
        default=0,
        server_default=text("0"),
    )
    variant_options: Mapped[list | dict | None] = mapped_column(JSON, nullable=True)
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

    seller: Mapped["SellerProfile"] = relationship(back_populates="products")
    product_categories: Mapped[list["ProductCategory"]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
    )
    categories: Mapped[list["Category"]] = relationship(
        secondary="product_categories", viewonly=True
    )
    images: Mapped[list["ProductImage"]] = relationship(
        back_populates="product",
        cascade="all, delete-orphan",
    )
    variants: Mapped[list["ProductVariant"]] = relationship(
        primaryjoin="and_(Product.id==ProductVariant.product_id, ProductVariant.status != 'DELETED')",
        back_populates="product",
        cascade="all, delete-orphan",
    )
    order_items: Mapped[list["OrderItem"]] = relationship(back_populates="product")
    reviews: Mapped[list["ProductReview"]] = relationship(back_populates="product")
    violation_reports: Mapped[list["ViolationReport"]] = relationship(
        back_populates="product",
    )
    moderation_logs: Mapped[list["ModerationLog"]] = relationship(
        back_populates="product",
    )
