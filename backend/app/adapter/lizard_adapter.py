from app.adapter.adapter import AnalysisAdapter
from app.utils.get_file_matrix import get_file_matrix_lizard
from typing import Optional
from app.model.analyzer_model import FileMetrics

class LizardAdapter(AnalysisAdapter):
    def supports(self, filename: str) -> bool:
        # Lizard is the fallback for everything else, or we can list extensions.
        # For now, let's say it supports everything not handled by others? 
        # Or explicitly list what lizard is good at. 
        # But usually in a chain, the last one is the fallback.
        # Let's return True as it is a generic quality analyzer.
        return True

    async def analyze_content(self, content: str, filename: str) -> Optional[FileMetrics]:
        # get_file_matrix_lizard is synchronous, so we just call it.
        # We might want to run it in a threadpool if it's heavy, but for now direct call is fine.
        return get_file_matrix_lizard(content, filename)
