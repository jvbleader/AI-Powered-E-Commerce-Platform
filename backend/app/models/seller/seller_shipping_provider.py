from __future__ import annotations

from sqlalchemy import ForeignKey
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Mapped, mapped_column

from models.base import Base


class SellerShippingProvider(Base):
    __tablename__ = "seller_shipping_providers"

    seller_id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("seller_profiles.id", ondelete="CASCADE"),
        primary_key=True,
    )
    shipping_provider_id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("shipping_providers.id", ondelete="CASCADE"),
        primary_key=True,
    )
