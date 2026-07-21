from uuid import UUID

from domain.models import JobStatus, AuditEvent
from domain.correlation import EvidenceGraph
from application.commands.evidence_commands import ProcessEvidenceCommand
from application.events.domain_events import AnalysisJobCompletedEvent
from application.ports.unit_of_work import IUnitOfWork
from application.ports.services import IClock, IStorageService
from application.ports.events import IEventDispatcher

# Abstracting the Engine interactions
class IEngineOrchestrator:
    async def execute_all(self, evidence_id: UUID, storage_uri: str) -> list: pass

class ICorrelationOrchestrator:
    def synthesize(self, graph: EvidenceGraph) -> tuple: pass

class ProcessEvidenceUseCase:
    def __init__(
        self,
        uow: IUnitOfWork,
        clock: IClock,
        storage: IStorageService,
        engine_orchestrator: IEngineOrchestrator,
        correlation_orchestrator: ICorrelationOrchestrator,
        dispatcher: IEventDispatcher
    ):
        self.uow = uow
        self.clock = clock
        self.storage = storage
        self.engine_orchestrator = engine_orchestrator
        self.correlation_orchestrator = correlation_orchestrator
        self.dispatcher = dispatcher

    async def execute(self, cmd: ProcessEvidenceCommand) -> None:
        async with self.uow:
            job = await self.uow.jobs.get(cmd.job_id)
            evidence = await self.uow.evidence.get(cmd.evidence_id)
            
            if not job or not evidence:
                raise ValueError("Job or Evidence not found")

            # Update Job Status
            job.status = JobStatus.RUNNING
            job.started_at = self.clock.utcnow()
            await self.uow.jobs.update(job)
            await self.uow.commit() # Commit running status immediately

        # Execute all forensic engines (ViT-CORE, C2PA, etc.)
        # This operates outside the DB transaction due to potential long execution times
        analysis_runs = await self.engine_orchestrator.execute_all(
            evidence_id=evidence.evidence_id,
            storage_uri=evidence.storage_uri
        )

        async with self.uow:
            # Save the immutable Facts
            for run in analysis_runs:
                await self.uow.analysis.add_run(run)

            # Build the Evidence Graph
            historical_assessments = [] # Would retrieve from repository if iterating
            graph = EvidenceGraph(
                evidence=evidence,
                analysis_runs=analysis_runs,
                assessment_history=historical_assessments
            )

            # Generate the policy-driven Assessment (Judgment)
            assessment, findings = self.correlation_orchestrator.synthesize(graph)
            
            # Save the Judgment
            await self.uow.analysis.add_assessment(assessment)
            
            # Update Evidence pointer and Job completion
            evidence.current_assessment_id = assessment.assessment_id
            await self.uow.evidence.update(evidence)
            
            job = await self.uow.jobs.get(cmd.job_id)
            job.status = JobStatus.COMPLETED
            job.finished_at = self.clock.utcnow()
            await self.uow.jobs.update(job)

            # Chain of custody audit
            audit = AuditEvent(
                timestamp=self.clock.utcnow(),
                actor="System Orchestrator",
                action="ANALYSIS_COMPLETED",
                resource_type="EVIDENCE",
                resource_id=evidence.evidence_id,
                metadata={"assessment_status": assessment.overall_status}
            )
            await self.uow.audit.add(audit)

        # Broadcast completion
        event = AnalysisJobCompletedEvent(
            job_id=job.job_id,
            evidence_id=evidence.evidence_id,
            assessment_id=assessment.assessment_id
        )
        await self.dispatcher.publish(event)
