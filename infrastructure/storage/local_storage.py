import os
import shutil
from pathlib import Path
from typing import BinaryIO
from uuid import uuid4

from application.ports.services import IStorageService

class LocalStorageService(IStorageService):
    """
    Local filesystem implementation of the storage service.
    Designed for secure, air-gapped deployments.
    """
    def __init__(self, base_dir: str = "/app/storage_vault"):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    async def store_evidence(self, file_stream: BinaryIO, filename: str) -> str:
        # Generate a unique directory to prevent filename collisions
        secure_id = str(uuid4())
        target_dir = self.base_dir / secure_id
        target_dir.mkdir(parents=True, exist_ok=True)
        
        file_path = target_dir / filename
        
        # In a fully async environment, this would use aiofiles or a threadpool
        with open(file_path, "wb") as f:
            shutil.copyfileobj(file_stream, f)
            
        # The storage_uri is an internal reference, not an absolute path
        return f"local://{secure_id}/{filename}"

    async def retrieve(self, storage_uri: str) -> BinaryIO:
        if not storage_uri.startswith("local://"):
            raise ValueError("Invalid storage URI protocol.")
            
        relative_path = storage_uri.replace("local://", "")
        file_path = self.base_dir / relative_path
        
        if not file_path.exists():
            raise FileNotFoundError(f"Evidence not found at {storage_uri}")
            
        return open(file_path, "rb")

    async def exists(self, storage_uri: str) -> bool:
        relative_path = storage_uri.replace("local://", "")
        file_path = self.base_dir / relative_path
        return file_path.exists()
