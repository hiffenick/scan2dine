"""Create QR codes table

Revision ID: a9f1e2c3d4b5
Revises: db15d3fcf4e0
Create Date: 2026-02-19 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a9f1e2c3d4b5'
down_revision = 'db15d3fcf4e0'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'qr_codes',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('table_no', sa.Integer(), nullable=False),
        sa.Column('qr_url', sa.Text(), nullable=False),
        sa.Column('qr_image_base64', sa.Text(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('deleted_at', sa.DateTime(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default='1'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_qr_codes_table_no'), 'qr_codes', ['table_no'])
    op.create_index(op.f('ix_qr_codes_created_at'), 'qr_codes', ['created_at'])
    op.create_index(op.f('ix_qr_codes_is_active'), 'qr_codes', ['is_active'])


def downgrade():
    op.drop_index(op.f('ix_qr_codes_is_active'), table_name='qr_codes')
    op.drop_index(op.f('ix_qr_codes_created_at'), table_name='qr_codes')
    op.drop_index(op.f('ix_qr_codes_table_no'), table_name='qr_codes')
    op.drop_table('qr_codes')
