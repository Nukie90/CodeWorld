from typing import Dict, Any

# Simple in-memory token store: access_token -> username
_TOKENS: Dict[str, str] = {}

# Global store for progress: task_id -> {"progress": int, "message": str, "done": bool}
_PROGRESS: Dict[str, Any] = {}

# Global store for analysis cache: commit_hash -> FolderAnalysisResult
_ANALYSIS_CACHE: Dict[str, Any] = {}
