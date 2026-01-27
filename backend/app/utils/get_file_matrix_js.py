import httpx
from typing import Optional
from app.model.analyzer_model import FileMetrics, FunctionMetric

# Define the URL of the Node.js service
ANALYZER_URL = "http://localhost:3001/analyze-code"

def get_file_matrix_js(code: str, filename: str) -> Optional[FileMetrics]:
    """
    Analyzes JS/JSX code by sending it to an external Node.js service.
    Returns FileMetrics if successful, None otherwise.
    """
    try:
        print("IS USED2")
        with httpx.Client(timeout=30.0) as client:
            response = client.post(
                ANALYZER_URL,
                json={"code": code, "filename": filename},
            )
            # Raise an exception for 4xx or 5xx status codes
            response.raise_for_status()

        data = response.json()

        # Create FunctionMetric objects from the received data
        functions = [FunctionMetric(**f) for f in data.get("functions", [])]

        # Create the FileMetrics object
        file_metrics = FileMetrics(
            filename=data["filename"],
            language=data.get("language"),
            total_loc=data["total_loc"],
            total_nloc=data["total_nloc"],
            function_count=data["function_count"],
            complexity_avg=data["complexity_avg"],
            complexity_max=data["complexity_max"],
            functions=functions,
        )
        return file_metrics

    except (httpx.RequestError, httpx.HTTPStatusError, KeyError) as e:
        print(f"Could not analyze JS file '{filename}' via Node.js service: {e}")
        return None
