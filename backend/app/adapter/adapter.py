from abc import ABC, abstractmethod
from fastapi import UploadFile

class AnalysisAdapter(ABC):
    @abstractmethod
    async def analyze_file(self, file: UploadFile):
        pass

    @abstractmethod
    async def analyze_zip(self, file: UploadFile):
        pass
