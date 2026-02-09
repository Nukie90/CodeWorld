# adapters/normalize.py
from typing import Dict, Any, List
from app.model.analyzer_model import FileMetrics, FunctionMetric, FolderMetrics
import os

def _infer_language(filename: str | None) -> str | None:
    if not filename:
        return None
    ext = os.path.splitext(filename)[1].lower()
    return {
        ".js": "javascript",
        ".jsx": "javascript",
        ".ts": "typescript",
        ".tsx": "typescript",
    }.get(ext, None)

def normalize_node_metrics(
    node_result: Dict[str, Any],
    filename: str | None = None
) -> FileMetrics:
    """
    Convert Node {LOC, NLOC, NOF, functions[{name,NLOC,CC,lineStart}]} -> FileMetrics
    Assumption: comment_lines ≈ LOC - NLOC (treating blanks+comments together so total_loc == LOC).
    """
    loc = int(node_result.get("LOC", 0))
    nloc = int(node_result.get("NLOC", 0))
    funcs_in: List[Dict[str, Any]] = node_result.get("functions", []) or []

    # Build FunctionMetric list
    funcs: List[FunctionMetric] = []
    cc_sum = 0
    cc_max = 0
    for f in funcs_in:
        name = f.get("name") or "anonymous"
        fm = FunctionMetric(
            name=name,
            start_line=f.get("lineStart"),
            nloc=int(f.get("NLOC", 0)),
            cyclomatic_complexity=int(f.get("CC", 0)),
        )
        funcs.append(fm)
        cc = fm.cyclomatic_complexity
        cc_sum += cc
        if cc > cc_max:
            cc_max = cc

    function_count = len(funcs)


    # comment_lines unavailable; approximate so total_loc matches LOC
    comment_lines = max(loc - nloc, 0)
    total_loc = nloc + comment_lines  # equals LOC under our approximation

    return FileMetrics(
        filename=filename or "unknown",
        language=_infer_language(filename),
        total_loc=total_loc,
        total_nloc=nloc,
        function_count=function_count,
        total_complexity=cc_sum,
        complexity_max=cc_max,
        functions=funcs,
    )

def normalize_node_zip(node_result: Dict[str, Any], folder_name: str = "src") -> Dict[str, Any]:
    """
    Convert Node /analyze-zip response:
    { totalFiles: N, results: [{fileName, metrics:{LOC,NLOC,NOF,functions[]}}] }
    → desired hierarchical FolderMetrics JSON
    """

    results: List[Dict[str, Any]] = node_result.get("results", []) or []

    all_files: List[FileMetrics] = []
    total_loc = total_nloc = total_functions = 0
    cc_sum = 0
    cc_max_global = 0

    for file_result in results:
        filename = file_result.get("fileName")
        metrics = file_result.get("metrics", {})
        # Convert each file metrics
        try:
            fm = normalize_node_metrics(metrics, filename)
            all_files.append(fm)

            # Aggregate folder metrics
            total_loc += fm.total_loc
            total_nloc += fm.total_nloc
            total_functions += fm.function_count
            cc_sum += fm.total_complexity
            cc_max_global = max(cc_max_global, fm.complexity_max)
        except Exception:
            # Handle potential errors during normalization
            continue

    total_files = len(all_files)

    folder_metrics = FolderMetrics(
        folder_name=folder_name,
        total_files=total_files,
        total_loc=total_loc,
        total_nloc=total_nloc,
        total_functions=total_functions,
        total_complexity=cc_sum,
        complexity_max=cc_max_global,
        files=all_files,
    )

    return {
        "folder_name": folder_name,
        "analysis": {
            "folder_metrics": folder_metrics.dict(),
            "individual_files": [f.dict() for f in all_files],
        },
    }

