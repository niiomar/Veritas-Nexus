"""add_soft_delete_columns

Revision ID: 7a150b9ac4b8
Revises: b7123bca21fe
Create Date: 2026-07-31 00:00:00.000000

Case and evidence deletion used to be immediate and irreversible - a
misclick or a bad bulk operation had no recovery path. This adds a
`deleted_at` marker so deletes become a grace-period soft-delete instead:
rows disappear from listings immediately but aren't physically purged (and
evidence files aren't removed from the storage vault) until the grace
period in api/worker.py's purge sweep elapses.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '7a150b9ac4b8'
down_revision: Union[str, None] = 'b7123bca21fe'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'cases',
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        schema='core',
    )
    op.add_column(
        'evidence',
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        schema='core',
    )


def downgrade() -> None:
    op.drop_column('evidence', 'deleted_at', schema='core')
    op.drop_column('cases', 'deleted_at', schema='core')
