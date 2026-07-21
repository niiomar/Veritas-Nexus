from typing import BinaryIO
from uuid import UUID

from domain.models import Evidence, AnalysisJob, AuditEvent
from application.commands.evidence_commands import UploadEvidenceCommand
from application.events.domain_events import EvidenceUploadedEvent
from application.ports.unit_of_work import IUnitOfWork
from application.ports.services import IStorageService, IHashService, IClock
from application.ports.events import IEventDispatcher

class UploadEvidenceUseCase:
    def __init__(
        self,
        uow: IUnitOfWork,
        storage: IStorageService,
        hasher: IHashService,
        clock: IClock,
        dispatcher: IEventDispatcher
    ):
        self.uow = uow
        self.storage = storage
        self.hasher = hasher
        self.clock = clock
        self.dispatcher = dispatcher

    async def execute(self, cmd: UploadEvidenceCommand, file_stream: BinaryIO) -> UUID:
        # 1. Generate cryptographic hash
        sha256_hash = await self.hasher.generate_sha256(file_stream)
        
        # 2. Persist raw file to the abstract storage service
        storage_uri = await self.storage.store_evidence(file_stream, cmd.filename)
        
        # 3. Create the Evidence domain entity
        evidence = Evidence(
            case_id=cmd.case_id,
            filename=cmd.filename,
            original_filename=cmd.original_filename,
            mime_type=cmd.mime_type,
            file_size=0, # In a real implementation, calculate size from stream
            sha256=sha256_hash,
            uploaded_by=cmd.uploaded_by,
            uploaded_at=self.clock.utcnow(),
            storage_uri=storage_uri
        )

        # 4. Create the pending Analysis Job
        job = AnalysisJob(evidence_id=evidence.evidence_id)

        # 5. Create the Chain of Custody Audit Event
        audit = AuditEvent(
            timestamp=self.clock.utcnow(),
            actor=cmd.uploaded_by,
            action="EVIDENCE_UPLOADED",
            resource_type="EVIDENCE",
            resource_id=evidence.evidence_id,
            metadata={"sha256": sha256_hash, "filename": cmd.filename}
        )

        # 6. Transactional Database Commit
        async with self.uow:
            await self.uow.evidence.add(evidence)
            await self.uow.jobs.add(job)
            await self.uow.audit.add(audit)

        # 7. Broadcast the event to trigger processing
        event = EvidenceUploadedEvent(
            evidence_id=evidence.evidence_id,
            case_id=cmd.case_id,
            storage_uri=storage_uri
        )
        await self.dispatcher.publish(event)

        return evidence.evidence_id
