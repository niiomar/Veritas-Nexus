import asyncio
from typing import List
from uuid import UUID
import logging

from domain.models import EngineId, AnalysisRun, AnalysisStatus
from domain.engines.base import IAnalysisEngine

logger = logging.getLogger(__name__)

class EngineRegistry:
    """
    The central discovery and execution hub for forensic plugins.
    """
    def __init__(self):
        self._engines: dict[EngineId, IAnalysisEngine] = {}

    def register(self, engine: IAnalysisEngine) -> None:
        self._engines[engine.engine_id] = engine
        logger.info(f"Registered Engine: {engine.engine_id.value} (v{engine.manifest.engine_version})")

    def get_engine(self, engine_id: EngineId) -> IAnalysisEngine:
        if engine_id not in self._engines:
            raise KeyError(f"Engine {engine_id} not registered.")
        return self._engines[engine_id]

    async def run_all(self, evidence_id: UUID, storage_uri: str, mime_type: str) -> List[AnalysisRun]:
        """
        Orchestrates parallel execution of all registered engines.
        """
        tasks = []
        for engine in self._engines.values():
            # If an engine doesn't support the media type, skip it safely
            if mime_type not in engine.manifest.supported_media and "*/*" not in engine.manifest.supported_media:
                logger.debug(f"Skipping {engine.engine_id}: Unsupported MIME {mime_type}")
                continue
                
            tasks.append(engine.analyze(evidence_id, storage_uri, mime_type))
            
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        valid_runs = []
        for result in results:
            if isinstance(result, Exception):
                logger.error(f"Engine execution failed: {str(result)}")
                # A robust implementation would construct a FAILED AnalysisRun here
                continue
            valid_runs.append(result)
            
        return valid_runs
