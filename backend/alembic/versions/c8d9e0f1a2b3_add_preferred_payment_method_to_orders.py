"""Add preferred_payment_method to orders."""

from alembic import op
import sqlalchemy as sa

revision = "c8d9e0f1a2b3"
down_revision = "a1b2c3d4e5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "orders",
        sa.Column("preferred_payment_method", sa.String(length=50), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("orders", "preferred_payment_method")
