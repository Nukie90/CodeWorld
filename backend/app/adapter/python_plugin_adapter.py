from app.adapter.adapter import AnalysisAdapter
from typing import Optional
from app.model.analyzer_model import FileMetrics
from app.python_plugin.python_analyzer import calculate_metrics

class PythonPluginAdapter(AnalysisAdapter):
    def supports(self, filename: str) -> bool:
        return filename.lower().endswith(('.py', '.pyw'))

    async def analyze_content(self, content: str, filename: str) -> Optional[FileMetrics]:
        # Reuse the logic which already calls the node service and returns FileMetrics
        return calculate_metrics(content, filename)

    async def lint_content(self, content: str, filename: str) -> Optional['FileLint']:
        from app.python_plugin.python_analyzer import run_ruff
        from app.model.analyzer_model import FileLint
        result = run_ruff(content, filename)
        return FileLint(
            lint_score=result.get("score"),
            lint_errors=result.get("errors", []),
            is_not_applicable=result.get("is_not_applicable", False),
            not_applicable_reason=result.get("not_applicable_reason"),
        )
