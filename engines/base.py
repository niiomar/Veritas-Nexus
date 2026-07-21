from abc import ABC, abstractmethod
from typing import BinaryIO
from uuid import UUID

from domain.models import AnalysisRun, EngineId, EngineManifest

class IAnalysisEngine(ABC):
    """
    The strict interface for all Veritas Nexus analysis plugins.
    Requires engines to explicitly identify themselves and execute analysis asynchronously.
    """
    
    @property
    @abstractmethod
    def engine_id(self) -> EngineId:
        """Returns the unique Enum identifier for this engine."""
        pass
    
    @property
    @abstractmethod
    def manifest(self) -> EngineManifest:
        """Returns the immutable snapshot of the engine's configuration and weights."""
        pass

    @abstractmethod
    async def analyze(
        self, 
        evidence_id: UUID, 
        file_stream: BinaryIO, 
        mime_type: str
    ) -> AnalysisRun:
        """
        Executes the analysis and returns raw Facts.
        The caller provides the file stream to decouple engines from storage mechanisms.
        """
        pass
