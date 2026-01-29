from app.adapter.adapter import AnalysisAdapter
from typing import Optional
from app.model.analyzer_model import FileMetrics
from app.utils.get_file_matrix_js import get_file_matrix_js

class PythonPluginAdapter(AnalysisAdapter):
    def supports(self, filename: str) -> bool:
        return filename.lower().endswith(('.py', '.pyw'))

    async def analyze_content(self, content: str, filename: str) -> Optional[FileMetrics]:
        # Reuse the logic which already calls the node service and returns FileMetrics
        return get_file_matrix_py(content, filename)