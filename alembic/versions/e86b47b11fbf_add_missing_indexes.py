"""add_missing_indexes

Revision ID: e86b47b11fbf
Revises: 33dd50ad370a
Create Date: 2026-08-01 00:00:00.000000

None of these had an index: evidence.case_id is joined/filtered on every
evidence listing query, cases.deleted_at and evidence.deleted_at are
filtered on every listing query (list_cases/list_evidence exclude
soft-deleted rows), and analysis_jobs.status is polled by
api/worker.py's poll loop every few seconds. All four are full table scans
today; harmless at demo scale, real cost once the tables grow.
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'e86b47b11fbf'
down_revision: Union[str, None] = '33dd50ad370a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index('ix_evidence_case_id', 'evidence', ['case_id'], schema='core')
    op.create_index('ix_cases_deleted_at', 'cases', ['deleted_at'], schema='core')
    op.create_index('ix_evidence_deleted_at', 'evidence', ['deleted_at'], schema='core')
    op.create_index('ix_analysis_jobs_status', 'analysis_jobs', ['status'], schema='analysis')


def downgrade() -> None:
    op.drop_index('ix_analysis_jobs_status', table_name='analysis_jobs', schema='analysis')
    op.drop_index('ix_evidence_deleted_at', table_name='evidence', schema='core')
    op.drop_index('ix_cases_deleted_at', table_name='cases', schema='core')
    op.drop_index('ix_evidence_case_id', table_name='evidence', schema='core')
