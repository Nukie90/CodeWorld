from app.adapter.adapter import AnalysisAdapter
from typing import Optional
from app.model.analyzer_model import FileMetrics
from app.utils.get_file_matrix_js import get_file_matrix_js, get_file_matrix_js_batch
import httpx
import os
class JSPluginAdapter(AnalysisAdapter):
    def supports(self, filename: str) -> bool:
        return filename.lower().endswith(('.js', '.jsx', '.ts', '.tsx'))

    async def analyze_content(self, content: str, filename: str) -> Optional[FileMetrics]:
        # Reuse the logic which already calls the node service and returns FileMetrics
        return get_file_matrix_js(content, filename)

    async def analyze_batch(self, files: list[tuple[str, str]]) -> list[Optional[FileMetrics]]:
        return get_file_matrix_js_batch(files)

    async def lint_content(self, content: str, filename: str) -> Optional['FileLint']:
        from app.model.analyzer_model import FileLint
        js_plugin_url = os.getenv("JS_PLUGIN_URL", "http://localhost:3001")
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(f"{js_plugin_url}/lint-code", json={"code": content, "filename": filename})
            if resp.status_code == 200:
                data = resp.json()
                return FileLint(lint_score=data.get("lint_score"), lint_errors=data.get("lint_errors", []))
        except Exception as e:
            print(f"Failed to fetch JS lint: {e}")
        return None