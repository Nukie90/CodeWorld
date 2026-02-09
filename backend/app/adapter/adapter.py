from abc import ABC, abstractmethod
from fastapi import UploadFile
from typing import Optional
from app.model.analyzer_model import FileMetrics

class AnalysisAdapter(ABC):
    @abstractmethod
    def supports(self, filename: str) -> bool:
        """Return True if this adapter can handle the given file."""
        pass

    @abstractmethod
    async def analyze_content(self, content: str, filename: str) -> Optional[FileMetrics]:
        """Analyze the content of a file and return metrics."""
        pass
