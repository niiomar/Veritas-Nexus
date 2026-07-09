from abc import ABC, abstractmethod
from datetime import datetime
from typing import List

class IIdentityProvider(ABC):
    @abstractmethod
    async def current_user(self) -> str:
        """Returns the ID of the currently authenticated user."""
        pass

    @abstractmethod
    async def current_roles(self) -> List[str]:
        """Returns the roles of the currently authenticated user."""
        pass

class IClock(ABC):
    @abstractmethod
    def now(self) -> datetime:
        """Returns the current timezone-aware UTC datetime."""
        pass

class IStorageService(ABC):
    @abstractmethod
    async def save(self, file_bytes: bytes, filename: str) -> str:
        """Saves a file and returns the storage URI/path."""
        pass

    @abstractmethod
    async def get(self, uri: str) -> bytes:
        """Retrieves file bytes from storage."""
        pass

class IHashService(ABC):
    @abstractmethod
    def hash(self, data: bytes) -> str:
        """Generates a secure hash (e.g., SHA256) for the given data."""
        pass