import os
from typing import List, Optional, Callable
from app.utils.get_file_matrix_js import get_file_matrix_js
from app.python_plugin.python_analyzer import calculate_metrics as get_file_matrix_python
from app.model.analyzer_model import FileMetrics, FolderMetrics, FolderAnalysisResult
from app.utils.ignore import build_ignore_checker


def analyze_local_folder(path: str, progress_callback: Optional[Callable] = None) -> FolderAnalysisResult:
    """Analyze a local folder on disk and return folder analysis result."""
    all_files = []
    # build ignore checker from .gitignore if present at repository root
    is_ignored = build_ignore_checker(path)

    if progress_callback: progress_callback(35, "Scanning directory structure")

    for root, dirs, files in os.walk(path):
        # allow os.walk to skip ignored directories early
        dirs[:] = [d for d in dirs if not is_ignored(os.path.join(root, d))]
        for file in files:
            file_path = os.path.join(root, file)
            # skip ignored files
            if is_ignored(file_path):
                continue
            relative_path = os.path.relpath(file_path, path)
            all_files.append((file_path, relative_path))

    file_metrics_list: List[FileMetrics] = []
    total_loc = 0
    total_nloc = 0
    total_functions = 0
    total_complexity = 0
    complexity_max = 0

    num_files = len(all_files)
    if progress_callback: progress_callback(40, f"Starting analysis of {num_files} files")

    for idx, (file_path, relative_path) in enumerate(all_files):
        try:
            # Update progress within 40% to 95% range
            if progress_callback and num_files > 0:
                current_progress = 40 + int((idx / num_files) * 55)
                progress_callback(current_progress, f"Analyzing: {relative_path}")

            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()

            file_metrics = None
            
            if relative_path.endswith(('.js', '.jsx', '.ts', '.tsx')):
                file_metrics = get_file_matrix_js(content, relative_path)
            elif relative_path.endswith('.py'):
                file_metrics = get_file_matrix_python(content, relative_path)
            else:
                # send the name of the file to the front end
                file_metrics = FileMetrics(
                    filename=relative_path,
                    total_loc=0,
                    total_nloc=0,
                    function_count=0,
                    total_complexity=0,
                    complexity_max=0,
                    is_unsupported=True,
                    functions=[]
                )

            if file_metrics is None:
                # Skip file if analysis failed (e.g., service down or parse error)
                continue

            file_metrics_list.append(file_metrics)

            total_loc += file_metrics.total_loc
            total_nloc += file_metrics.total_nloc
            total_functions += file_metrics.function_count
            total_complexity += file_metrics.total_complexity
            if (file_metrics.complexity_max or 0) > complexity_max:
                complexity_max = file_metrics.complexity_max

        except Exception as e:
            print(f"Skipping file {relative_path} due to error: {e}")
            # skip unreadable files or other unexpected errors
            continue

    folder_metrics = FolderMetrics(
        folder_name=os.path.basename(path),
        total_files=len(file_metrics_list),
        total_loc=total_loc,
        total_nloc=total_nloc,
        total_functions=total_functions,
        total_complexity=total_complexity,
        complexity_max=complexity_max,
        files=file_metrics_list,
    )

    return FolderAnalysisResult(folder_metrics=folder_metrics, individual_files=file_metrics_list)
