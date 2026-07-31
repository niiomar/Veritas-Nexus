"""add_users_table

Revision ID: 33dd50ad370a
Revises: 7a150b9ac4b8
Create Date: 2026-07-31 00:00:00.000000

Backing store for real per-user authentication (api/routers/auth.py),
replacing the shared PLATFORM_API_KEY stopgap.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '33dd50ad370a'
down_revision: Union[str, None] = '7a150b9ac4b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'users',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('password_hash', sa.String(), nullable=False),
        sa.Column('is_verified', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('role', sa.String(), nullable=False, server_default='ANALYST'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        schema='core',
    )
    op.create_index(op.f('ix_core_users_email'), 'users', ['email'], unique=True, schema='core')


def downgrade() -> None:
    op.drop_index(op.f('ix_core_users_email'), table_name='users', schema='core')
    op.drop_table('users', schema='core')
