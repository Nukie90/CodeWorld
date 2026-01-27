from typing import List
from app.adapter.adapter import AnalysisAdapter
from app.adapter.js_plugin_adapter import JSPluginAdapter
from app.adapter.lizard_adapter import LizardAdapter

def get_adapters() -> List[AnalysisAdapter]:
    """Return a list of all available analysis adapters."""
    # Order matters: more specific adapters first, fallback (Lizard) last.
    return [
        JSPluginAdapter(),
        LizardAdapter()
    ]

def get_analysis_adapter(adapter_type: str) -> AnalysisAdapter:
    if adapter_type == "js-plugin":
        return JSPluginAdapter()
    elif adapter_type == "lizard":
        return LizardAdapter()
    else:
        raise ValueError(f"Unknown adapter type: {adapter_type}")
