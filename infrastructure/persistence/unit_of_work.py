from sqlalchemy.ext.asyncio import AsyncSession
from application.ports.unit_of_work import IUnitOfWork
from infrastructure.repositories.sql_case_repository import SQLCaseRepository
# Ensure you import your audit repository here
from infrastructure.repositories.sql_audit_repository import SQLAuditRepository 

class SQLUnitOfWork(IUnitOfWork):
    def __init__(self, session_factory):
        self.session_factory = session_factory

    async def __aenter__(self):
        self.session: AsyncSession = self.session_factory()
        self.cases = SQLCaseRepository(self.session)
        # Initialize the audit repository here
        self.audit = SQLAuditRepository(self.session)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if exc_type:
            await self.session.rollback()
        else:
            await self.session.commit()
        await self.session.close()

    async def commit(self):
        await self.session.commit()

    async def rollback(self):
        await self.session.rollback()