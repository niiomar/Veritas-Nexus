from uuid import UUID

from domain.models import Report, AuditEvent
from application.ports.unit_of_work import IUnitOfWork
from application.ports.services import IReportService, IStorageService, IHashService, IClock, IIdentityProvider

class GenerateReportUseCase:
    def __init__(
        self, 
        uow: IUnitOfWork, 
        report_service: IReportService,
        storage: IStorageService,
        hasher: IHashService,
        clock: IClock,
        identity: IIdentityProvider
    ):
        self.uow = uow
        self.report_service = report_service
        self.storage = storage
        self.hasher = hasher
        self.clock = clock
        self.identity = identity

    async def execute(self, assessment_id: UUID, evidence_id: UUID) -> UUID:
        actor = await self.identity.current_user()
        
        async with self.uow:
            evidence = await self.uow.evidence.get(evidence_id)
            assessment = await self.uow.analysis.get_latest_assessment(evidence_id)
            runs = await self.uow.analysis.get_runs_for_evidence(evidence_id)
            
            if not evidence or not assessment:
                raise ValueError("Incomplete data for report generation.")

        # 1. Generate the physical document (PDF/HTML) using the Infrastructure adapter
        report_stream = await self.report_service.generate_report(assessment, runs, evidence)
        
        # 2. Cryptographically seal the report
        report_hash = await self.hasher.generate_sha256(report_stream)
        
        # 3. Write to secure storage
        filename = f"Report_{evidence.original_filename}_{self.clock.utcnow().strftime('%Y%m%d')}.pdf"
        storage_uri = await self.storage.store_evidence(report_stream, filename)

        # 4. Create the immutable Report domain entity
        report = Report(
            evidence_id=evidence_id,
            assessment_id=assessment_id,
            report_type="AUTHENTICITY_ASSESSMENT",
            generated_at=self.clock.utcnow(),
            generated_by=actor,
            storage_uri=storage_uri,
            sha256=report_hash
        )

        audit = AuditEvent(
            timestamp=self.clock.utcnow(),
            actor=actor,
            action="REPORT_GENERATED",
            resource_type="REPORT",
            resource_id=report.report_id,
            metadata={"sha256": report_hash}
        )

        async with self.uow:
            # (Requires a ReportRepository port implementation to persist)
            # await self.uow.reports.add(report)
            await self.uow.audit.add(audit)

        return report.report_id