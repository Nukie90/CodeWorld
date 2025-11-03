import os
from typing import List
from app.utils.get_file_matrix import get_file_matrix
from app.model.analyzer_model import FileMetrics, FunctionMetric, FolderMetrics, FolderAnalysisResult
from app.utils.ignore import build_ignore_checker


def analyze_local_folder(path: str) -> FolderAnalysisResult:
    """Analyze a local folder on disk and return folder analysis result."""
    js_files = []
    # build ignore checker from .gitignore if present at repository root
    is_ignored = build_ignore_checker(path)

    for root, dirs, files in os.walk(path):
        # allow os.walk to skip ignored directories early
        dirs[:] = [d for d in dirs if not is_ignored(os.path.join(root, d))]
        for file in files:
            file_path = os.path.join(root, file)
            # skip ignored files
            if is_ignored(file_path):
                continue
            relative_path = os.path.relpath(file_path, path)
            js_files.append((file_path, relative_path))

    file_metrics_list: List[FileMetrics] = []
    total_loc = 0
    total_nloc = 0
    total_functions = 0
    complexity_sum = 0
    complexity_max = 0

    for file_path, relative_path in js_files:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()
            file_metrics = get_file_matrix(content, relative_path)
            file_metrics_list.append(file_metrics)

            total_loc += file_metrics.total_loc
            total_nloc += file_metrics.total_nloc
            total_functions += file_metrics.function_count
            complexity_sum += file_metrics.complexity_avg * file_metrics.function_count
            if file_metrics.complexity_max > complexity_max:
                complexity_max = file_metrics.complexity_max
        except Exception:
            # skip unreadable files
            continue

    folder_complexity_avg = round(complexity_sum / total_functions, 2) if total_functions > 0 else 0.0

    folder_metrics = FolderMetrics(
        folder_name=os.path.basename(path),
        total_files=len(file_metrics_list),
        total_loc=total_loc,
        total_nloc=total_nloc,
        total_functions=total_functions,
        complexity_avg=folder_complexity_avg,
        complexity_max=complexity_max,
        files=file_metrics_list,
    )

    return FolderAnalysisResult(folder_metrics=folder_metrics, individual_files=file_metrics_list)
