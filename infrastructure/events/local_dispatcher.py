import asyncio
from typing import Callable, Dict, List
import logging

from application.events.domain_events import DomainEvent
from application.ports.events import IEventDispatcher

logger = logging.getLogger(__name__)


class LocalEventDispatcher(IEventDispatcher):
    """
    In-memory event bus. 
    Can be replaced with a Redis or Kafka adapter for horizontal scaling.
    """
    def __init__(self):
        self._handlers: Dict[str, List[Callable]] = {}

    def subscribe(self, event_type: type, handler: Callable):
        event_name = event_type.__name__
        if event_name not in self._handlers:
            self._handlers[event_name] = []
        self._handlers[event_name].append(handler)
        logger.info(f"Subscribed {handler.__name__} to {event_name}")

    async def publish(self, event: DomainEvent) -> None:
        event_name = type(event).__name__
        handlers = self._handlers.get(event_name, [])
        
        if not handlers:
            logger.debug(f"No handlers subscribed to {event_name}")
            return
            
        # Execute handlers concurrently as background tasks to prevent blocking
        tasks = [asyncio.create_task(handler(event)) for handler in handlers]
        await asyncio.gather(*tasks, return_exceptions=True)

    async def publish_many(self, events: List[DomainEvent]) -> None:
        for event in events:
            await self.publish(event)