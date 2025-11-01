from app.adapter.adapter import AnalysisAdapter
from app.adapter.js_plugin_adapter import JSPluginAdapter

def get_analysis_adapter(adapter_type: str) -> AnalysisAdapter:
    if adapter_type == "js-plugin":
        return JSPluginAdapter()
    else:
        raise ValueError(f"Unknown adapter type: {adapter_type}")
