from lizard import analyze_file
from typing import Any, Dict, List, Optional

def analyze_code(code: str) -> Dict[str, Any]:
    if not code:
        return {
            "nloc": 0,
            "token_count": 0,
            "function_count": 0,
            "functions": [],
            "summary": {
                "characters": 0,
                "average_line_length": 0,
            },
        }

    analysis = analyze_file.analyze_source_code("uploaded_file", code)

    return {
        "nloc": getattr(analysis, "nloc", 0),
        "token_count": getattr(analysis, "token_count", 0),
        "function_count": len(getattr(analysis, "function_list", [])),
        "functions": serialize_functions(getattr(analysis, "function_list", [])),
    }

def get_function_start_line(func) -> Optional[int]:
    """Helper to extract the start line from a function object."""
    for attr in ("start_line", "long_name_start_line", "line", "start_point"):
        if hasattr(func, attr):
            try:
                val = getattr(func, attr)
                if isinstance(val, tuple) and len(val) >= 1:
                    return int(val[0])
                else:
                    return int(val)
            except Exception:
                continue
    return None

def serialize_functions(functions) -> List[Dict[str, Any]]:
    serialized = []
    for func in functions:
        start_line = get_function_start_line(func)
        serialized.append(
            {
                "name": getattr(func, "name", "<anonymous>"),
                "nloc": getattr(func, "nloc", 0),
                "cyclomatic_complexity": getattr(func, "cyclomatic_complexity", 0),
                "parameters": getattr(func, "parameter_count", 0),
                "start_line": start_line,
            }
        )
    return serialized