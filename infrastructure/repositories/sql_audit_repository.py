from domain.models import AuditEvent
from infrastructure.persistence.models import AuditEventORM

class SQLAuditRepository:
    def __init__(self, session):
        self.session = session

    async def add(self, audit_entry: AuditEvent) -> None:
        # Convert Domain model (dataclass) to ORM model
        orm_audit = AuditEventORM(
            id=audit_entry.event_id,
            resource_id=audit_entry.resource_id,
            action=audit_entry.action,
            created_at=audit_entry.timestamp,
            performed_by=audit_entry.actor
        )
        self.session.add(orm_audit)
        await self.session.flush()