"""add_reports_table

Revision ID: 31cf0eb9da8c
Revises: e86b47b11fbf
Create Date: 2026-08-02 00:00:00.000000

Backs real PDF report generation (api/routers/reports.py,
api/services/report_service.py), replacing what used to be a hardcoded
fake response with no persisted artifact. Each row is one generated
PDF snapshot: who generated it, when, and where the file lives.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '31cf0eb9da8c'
down_revision: Union[str, None] = 'e86b47b11fbf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'reports',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('evidence_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('core.evidence.id'), nullable=False),
        sa.Column('storage_uri', sa.String(), nullable=False),
        sa.Column('sha256', sa.String(), nullable=False),
        sa.Column('generated_by', sa.String(), nullable=False),
        sa.Column('generated_at', sa.DateTime(timezone=True), nullable=False),
        schema='core',
    )
    op.create_index('ix_reports_evidence_id', 'reports', ['evidence_id'], schema='core')


def downgrade() -> None:
    op.drop_index('ix_reports_evidence_id', table_name='reports', schema='core')
    op.drop_table('reports', schema='core')
