"""add_ai_report_case_alias_analyst

Revision ID: b7123bca21fe
Revises: f151b1e1de8d
Create Date: 2026-07-30 00:00:00.000000

The application code (api/worker.py, api/routers/evidence.py,
api/routers/cases.py) has been reading and writing these columns for a
while, but they were never captured in a migration - the live database
was patched out of band. This migration brings schema history back in
sync with what the app actually requires so a fresh `alembic upgrade
head` produces a working database.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'b7123bca21fe'
down_revision: Union[str, None] = 'f151b1e1de8d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'analysis_jobs',
        sa.Column('ai_report', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        schema='analysis',
    )
    op.add_column(
        'cases',
        sa.Column('alias', sa.String(), nullable=True),
        schema='core',
    )
    op.add_column(
        'cases',
        sa.Column('analyst', sa.String(), nullable=True),
        schema='core',
    )


def downgrade() -> None:
    op.drop_column('cases', 'analyst', schema='core')
    op.drop_column('cases', 'alias', schema='core')
    op.drop_column('analysis_jobs', 'ai_report', schema='analysis')
