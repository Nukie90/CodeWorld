import httpx
from typing import Optional, List, Tuple
from app.model.analyzer_model import FileMetrics, FunctionMetric

# Define the URL of the Node.js service
ANALYZER_URL = "http://localhost:3001/analyze-code-stream"
ANALYZER_BATCH_URL = "http://localhost:3001/analyze-batch-stream"

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
        return [_parse_response(r) if "error" not in r else None for r in results]
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
        return FileMetrics(
            filename=data["filename"],
            language=data.get("language"),
            total_loc=data["total_loc"],
            total_lloc=data["total_lloc"],
            function_count=data["function_count"],
            total_complexity=data["total_complexity"],
            maintainability_index=data.get("maintainability_index"),
            functions=functions,
        )
    except (KeyError, TypeError) as e:
        print(f"Failed to parse analyzer response: {e}")
        return None
