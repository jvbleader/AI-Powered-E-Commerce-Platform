from __future__ import annotations

from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Numeric, String
from sqlalchemy.dialects import mysql
from sqlalchemy.orm import Mapped, mapped_column, relationship

from models.base import Base, utc_now

if TYPE_CHECKING:
    from models.order.order import Order
    from models.seller.seller_payout import SellerPayout
    from models.seller.seller_profile import SellerProfile
    from models.seller.seller_wallet import SellerWallet


class SellerWalletTransaction(Base):
    __tablename__ = "seller_wallet_transactions"

    __table_args__ = (
        CheckConstraint(
            "transaction_type IN ('ORDER_SETTLEMENT', 'WITHDRAWAL', 'REFUND_DEDUCTION', 'ADJUSTMENT')",
            name="ck_seller_wallet_transactions_type",
        ),
        Index("ix_seller_wallet_tx_wallet_id", "wallet_id"),
        Index("ix_seller_wallet_tx_seller_id", "seller_id"),
        Index("ix_seller_wallet_tx_order_id", "order_id"),
        Index("ix_seller_wallet_tx_payout_id", "payout_id"),
        Index("ix_seller_wallet_tx_created_at", "created_at"),
    )

    id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        primary_key=True,
        autoincrement=True,
    )
    wallet_id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("seller_wallets.id"),
        nullable=False,
    )
    seller_id: Mapped[int] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("seller_profiles.id"),
        nullable=False,
    )
    transaction_type: Mapped[str] = mapped_column(String(30), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    balance_before: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    balance_after: Mapped[Decimal] = mapped_column(Numeric(14, 2), nullable=False)
    gross_amount: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    payment_fee: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    commission_fee: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    order_id: Mapped[int | None] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("orders.id"),
        nullable=True,
    )
    payout_id: Mapped[int | None] = mapped_column(
        mysql.BIGINT(unsigned=True),
        ForeignKey("seller_payouts.id"),
        nullable=True,
    )
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=utc_now,
    )

    wallet: Mapped["SellerWallet"] = relationship(back_populates="transactions")
    seller: Mapped["SellerProfile"] = relationship()
    order: Mapped["Order | None"] = relationship()
    payout: Mapped["SellerPayout | None"] = relationship()
