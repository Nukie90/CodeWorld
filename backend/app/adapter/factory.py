from typing import List
from app.adapter.adapter import AnalysisAdapter
from app.adapter.js_plugin_adapter import JSPluginAdapter
from app.adapter.python_plugin_adapter import PythonPluginAdapter

def get_adapters() -> List[AnalysisAdapter]:
    """Return a list of all available analysis adapters."""
    # Order matters: more specific adapters first, fallback (Lizard) last.
    return [
        JSPluginAdapter(),
        PythonPluginAdapter(),
    ]
