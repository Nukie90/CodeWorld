import httpx
from typing import Optional, List, Tuple
from app.model.analyzer_model import FileMetrics, FunctionMetric
from app.utils.analysis_helpers import ensure_file_total_cognitive_complexity

import os

JS_PLUGIN_URL = os.getenv("JS_PLUGIN_URL", "http://localhost:3001")
ANALYZER_URL = f"{JS_PLUGIN_URL}/analyze-code-stream"
ANALYZER_BATCH_URL = f"{JS_PLUGIN_URL}/analyze-batch-stream"

# Shared persistent HTTP client to avoid connection setup overhead on every call
_CLIENT = httpx.Client(timeout=60.0)


def get_file_matrix_js(code: str, filename: str) -> Optional[FileMetrics]:
    """
    Analyzes a single JS/JSX file via the Node.js service.
    Prefer get_file_matrix_js_batch() when analyzing multiple files.
    """
    try:
        response = _CLIENT.post(
            ANALYZER_URL,
            data={"path": filename},
            files={"file": (filename, code.encode('utf-8'))},
        )
        response.raise_for_status()
        return _parse_response(response.json())
    except (httpx.RequestError, httpx.HTTPStatusError, KeyError) as e:
        print(f"Could not analyze JS file '{filename}' via Node.js service: {e}")
        if hasattr(e, 'response') and e.response is not None:
             print(e.response.text)
        return None


def get_file_matrix_js_batch(files: List[Tuple[str, str]]) -> List[Optional[FileMetrics]]:
    """
    Analyze multiple JS/JSX files in a single HTTP request to /analyze-batch-stream.
    files: list of (code, filename) tuples
    Returns a list of FileMetrics (or None on per-file error) in the same order.
    """
    if not files:
        return []
    try:
        payload = [("files", (filename, code.encode('utf-8'))) for code, filename in files]
        data_payload = {"paths": [filename for code, filename in files]}
        response = _CLIENT.post(
            ANALYZER_BATCH_URL,
            data=data_payload,
            files=payload,
        )
        response.raise_for_status()
        results = response.json()
        return [_parse_response(r) for r in results]
    except (httpx.RequestError, httpx.HTTPStatusError) as e:
        print(f"Batch JS analysis failed: {e}. Falling back to individual calls.")
        if hasattr(e, 'response') and e.response is not None:
             print(e.response.text)
        # Graceful fallback: call one-by-one
        return [get_file_matrix_js(code, fname) for code, fname in files]


def _parse_response(data: dict) -> Optional[FileMetrics]:
    """Convert a raw analyzer response dict into a FileMetrics object."""
    try:
        functions = [FunctionMetric(**f) for f in data.get("functions", [])]
        file_metrics = FileMetrics(
            filename=data["filename"],
            language=data.get("language"),
            total_loc=data["total_loc"],
            total_lloc=data["total_lloc"],
            function_count=data["function_count"],
            total_complexity=data["total_complexity"],
            total_cognitive_complexity=data.get("total_cognitive_complexity"),
            halstead_volume=data.get("halstead_volume"),
            maintainability_index=data.get("maintainability_index"),
            is_unsupported=data.get("is_unsupported", False),
            analysis_error=data.get("analysis_error") or data.get("error"),
            functions=functions,
        )
        return ensure_file_total_cognitive_complexity(file_metrics)
    except (KeyError, TypeError) as e:
        print(f"Failed to parse analyzer response: {e}")
        return None
