from uuid import UUID

from domain.models import Case, CasePriority, CaseStatus, AuditEvent
from application.commands.case_commands import CreateCaseCommand, CloseCaseCommand
from application.ports.unit_of_work import IUnitOfWork
from application.ports.services import IIdentityProvider, IClock

class CreateCaseUseCase:
    def __init__(self, uow: IUnitOfWork, identity: IIdentityProvider, clock: IClock):
        self.uow = uow
        self.identity = identity
        self.clock = clock

    async def execute(self, cmd: CreateCaseCommand) -> UUID:
        actor = await self.identity.current_user()
        now = self.clock.utcnow()
        
        # Generates a standard NSB identifier
        case_num = f"NSB-{now.year}-{now.strftime('%m%d%H%M')}"
        
        case = Case(
            case_number=case_num,
            title=cmd.title,
            description=cmd.description,
            priority=CasePriority(cmd.priority.upper()),
            created_by=actor,
            created_at=now,
            updated_at=now
        )

        audit = AuditEvent(
            timestamp=now,
            actor=actor,
            action="CASE_CREATED",
            resource_type="CASE",
            resource_id=case.case_id
        )

        async with self.uow:
            await self.uow.cases.add(case)
            await self.uow.audit.add(audit)

        return case.case_id

class CloseCaseUseCase:
    def __init__(self, uow: IUnitOfWork, clock: IClock):
        self.uow = uow
        self.clock = clock

    async def execute(self, cmd: CloseCaseCommand) -> None:
        async with self.uow:
            case = await self.uow.cases.get(cmd.case_id)
            if not case:
                raise ValueError("Case not found.")

            case.status = CaseStatus.CLOSED
            case.updated_at = self.clock.utcnow()
            
            audit = AuditEvent(
                timestamp=self.clock.utcnow(),
                actor=cmd.closed_by,
                action="CASE_CLOSED",
                resource_type="CASE",
                resource_id=case.case_id
            )

            await self.uow.cases.update(case)
            await self.uow.audit.add(audit)
