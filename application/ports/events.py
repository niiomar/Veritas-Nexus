from abc import ABC, abstractmethod
from typing import List
from application.events.domain_events import DomainEvent

class IEventDispatcher(ABC):
    @abstractmethod
    async def publish(self, event: DomainEvent) -> None:
        pass

    @abstractmethod
    async def publish_many(self, events: List[DomainEvent]) -> None:
        pass