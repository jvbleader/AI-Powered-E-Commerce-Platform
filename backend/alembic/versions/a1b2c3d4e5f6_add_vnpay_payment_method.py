"""Add VNPAY to payments.payment_method check constraint."""

from typing import Sequence, Union

from alembic import op

revision: str = "a1b2c3d4e5f6"
down_revision: Union[str, Sequence[str], None] = "f2a3b4c5d6e7"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint("ck_payments_payment_method", "payments", type_="check")
    op.create_check_constraint(
        "ck_payments_payment_method",
        "payments",
        "payment_method IN ('BANK', 'MOMO', 'CREDIT_CARD', 'MOCK', 'VNPAY')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_payments_payment_method", "payments", type_="check")
    op.create_check_constraint(
        "ck_payments_payment_method",
        "payments",
        "payment_method IN ('BANK', 'MOMO', 'CREDIT_CARD', 'MOCK')",
    )
