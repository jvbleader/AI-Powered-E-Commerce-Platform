"""create_platform_finance_tables

Revision ID: f3a4b5c6d7e8
Revises: e2f3a4b5c6d7
Create Date: 2026-08-26 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import mysql

# revision identifiers, used by Alembic.
revision: str = "f3a4b5c6d7e8"
down_revision: Union[str, Sequence[str], None] = "e2f3a4b5c6d7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    existing_tables = inspector.get_table_names()

    # 1. Create platform_finance_summary table
    if "platform_finance_summary" not in existing_tables:
        op.create_table(
            "platform_finance_summary",
            sa.Column("id", mysql.BIGINT(unsigned=True), primary_key=True, autoincrement=True, nullable=False),
            sa.Column("escrow_holding_balance", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
            sa.Column("total_platform_revenue", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
            sa.Column("total_commission_fee_collected", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
            sa.Column("total_payment_fee_collected", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
            sa.Column("total_seller_balances", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
            sa.Column("total_payouts_disbursed", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
            sa.Column("total_refunded_amount", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(), nullable=True, onupdate=sa.func.now()),
            sa.CheckConstraint("escrow_holding_balance >= 0", name="ck_platform_finance_escrow_holding"),
            sa.CheckConstraint("total_platform_revenue >= 0", name="ck_platform_finance_revenue"),
            sa.CheckConstraint("total_commission_fee_collected >= 0", name="ck_platform_finance_comm_fee"),
            sa.CheckConstraint("total_payment_fee_collected >= 0", name="ck_platform_finance_pay_fee"),
            sa.CheckConstraint("total_seller_balances >= 0", name="ck_platform_finance_seller_balances"),
            sa.CheckConstraint("total_payouts_disbursed >= 0", name="ck_platform_finance_payouts_disbursed"),
            sa.CheckConstraint("total_refunded_amount >= 0", name="ck_platform_finance_refunded"),
        )

    # 2. Create platform_finance_transactions table
    if "platform_finance_transactions" not in existing_tables:
        op.create_table(
            "platform_finance_transactions",
            sa.Column("id", mysql.BIGINT(unsigned=True), primary_key=True, autoincrement=True, nullable=False),
            sa.Column("transaction_type", sa.String(30), nullable=False),
            sa.Column("amount", sa.Numeric(14, 2), nullable=False),
            sa.Column("escrow_before", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
            sa.Column("escrow_after", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
            sa.Column("revenue_before", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
            sa.Column("revenue_after", sa.Numeric(14, 2), nullable=False, server_default="0.00"),
            sa.Column("order_id", mysql.BIGINT(unsigned=True), sa.ForeignKey("orders.id", ondelete="SET NULL"), nullable=True),
            sa.Column("payout_id", mysql.BIGINT(unsigned=True), sa.ForeignKey("seller_payouts.id", ondelete="SET NULL"), nullable=True),
            sa.Column("description", sa.String(255), nullable=False),
            sa.Column("created_at", sa.DateTime(), nullable=False, server_default=sa.func.now()),
            sa.CheckConstraint(
                "transaction_type IN ('ESCROW_INFLOW', 'ESCROW_RELEASE', 'REVENUE_EARNED', 'PAYOUT_DISBURSED', 'ESCROW_REFUND', 'ADJUSTMENT')",
                name="ck_platform_finance_transactions_type",
            ),
        )
        op.create_index("ix_platform_finance_tx_created_at", "platform_finance_transactions", ["created_at"])
        op.create_index("ix_platform_finance_tx_order_id", "platform_finance_transactions", ["order_id"])
        op.create_index("ix_platform_finance_tx_payout_id", "platform_finance_transactions", ["payout_id"])
        op.create_index("ix_platform_finance_tx_type", "platform_finance_transactions", ["transaction_type"])


def downgrade() -> None:
    op.drop_table("platform_finance_transactions")
    op.drop_table("platform_finance_summary")
