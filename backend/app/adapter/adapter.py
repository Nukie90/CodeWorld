from abc import ABC, abstractmethod
from typing import Optional
from app.model.analyzer_model import FileMetrics, FileLint

class AnalysisAdapter(ABC):
    @abstractmethod
    def supports(self, filename: str) -> bool:
        """Return True if this adapter can handle the given file."""
        pass

    @abstractmethod
    async def analyze_content(self, content: str, filename: str) -> Optional[FileMetrics]:
        """Analyze the content of a file and return metrics."""
        pass

    @abstractmethod
    async def lint_content(self, content: str, filename: str) -> Optional['FileLint']:
        """Lint the content of a file and return lint metrics."""
        pass

    async def analyze_batch(self, files: list[tuple[str, str]]) -> list[Optional[FileMetrics]]:
        """Analyze a batch of files (content, filename) sequentially or concurrently.
        By default, it executes analyze_content for each file using asyncio.gather.
        """
        import asyncio
        tasks = [self.analyze_content(content, filename) for content, filename in files]
        return await asyncio.gather(*tasks, return_exceptions=False)
