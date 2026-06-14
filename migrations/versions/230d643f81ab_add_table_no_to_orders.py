"""add table_no to orders

Revision ID: 230d643f81ab
Revises: db15d3fcf4e0
Create Date: 2026-01-27 19:20:15.080385
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '230d643f81ab'
down_revision = 'db15d3fcf4e0'
branch_labels = None
depends_on = None


def upgrade():
    # ONLY add column to orders — do NOT touch User table
    with op.batch_alter_table('orders', schema=None) as batch_op:
        batch_op.add_column(
            sa.Column('table_no', sa.Integer(), nullable=True)
        )


def downgrade():
    # ONLY remove column from orders
    with op.batch_alter_table('orders', schema=None) as batch_op:
        batch_op.drop_column('table_no')
