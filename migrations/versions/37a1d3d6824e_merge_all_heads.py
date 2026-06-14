"""Merge all heads

Revision ID: 37a1d3d6824e
Revises: 230d643f81ab, a8f3c9b2d4e6, a9f1e2c3d4b5, b98303054ebe
Create Date: 2026-02-19 14:54:01.552782

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '37a1d3d6824e'
down_revision = ('230d643f81ab', 'a8f3c9b2d4e6', 'a9f1e2c3d4b5', 'b98303054ebe')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
