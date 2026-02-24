import os
from typing import List, Optional, Callable
import pygount
from app.utils.get_file_matrix_js import get_file_matrix_js
from app.python_plugin.python_analyzer import calculate_metrics as get_file_matrix_python
from app.model.analyzer_model import FileMetrics, FolderMetrics, FolderAnalysisResult
from app.utils.ignore import build_ignore_checker


def analyze_local_folder(
    path: str, 
    progress_callback: Optional[Callable] = None,
    previous_analysis: Optional[FolderAnalysisResult] = None,
    changed_files: Optional[List[str]] = None
) -> FolderAnalysisResult:
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
            relative_path = os.path.relpath(file_path, path).replace(os.path.sep, '/')
            all_files.append((file_path, relative_path))

    file_metrics_list: List[FileMetrics] = []
    total_loc = 0
    total_nloc = 0
    total_functions = 0
    total_complexity = 0
    complexity_max = 0

    num_files = len(all_files)
    if progress_callback: progress_callback(40, f"Starting analysis of {num_files} files")

    # Build a lookup for previous file metrics
    previous_metrics_map = {}
    if previous_analysis and previous_analysis.individual_files:
        for metric in previous_analysis.individual_files:
            # Filename might contain \n(language), we only need the relative path
            clean_name = metric.filename.split('\n')[0]
            previous_metrics_map[clean_name] = metric

    changed_files_set = set(changed_files) if changed_files is not None else None

    for idx, (file_path, relative_path) in enumerate(all_files):
        try:
            # Update progress within 40% to 95% range
            if progress_callback and num_files > 0:
                current_progress = 40 + int((idx / num_files) * 55)
                progress_callback(current_progress, f"Analyzing: {relative_path}")

            # If doing incremental analysis, check if we can reuse the cached metric
            if changed_files_set is not None and relative_path not in changed_files_set:
                prev_metric = previous_metrics_map.get(relative_path)
                if prev_metric:
                    file_metrics_list.append(prev_metric)
                    total_loc += prev_metric.total_loc
                    total_nloc += prev_metric.total_nloc
                    total_functions += prev_metric.function_count
                    total_complexity += prev_metric.total_complexity
                    if (prev_metric.complexity_max or 0) > complexity_max:
                        complexity_max = prev_metric.complexity_max
                    continue

            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()

            file_metrics = None
            
            if relative_path.endswith(('.js', '.jsx', '.ts', '.tsx')):
                file_metrics = get_file_matrix_js(content, relative_path)
            elif relative_path.endswith('.py'):
                file_metrics = get_file_matrix_python(content, relative_path)
            else:
                # Use pygount for unsupported files
                # send the name of the file to the front end
                print(f"Unsupported file (using pygount): {relative_path}")
                
                try:
                    # Create a temporary SourceAnalysis object
                    # We pass the file path directly to pygount for reliable encoding handling
                    analysis = pygount.SourceAnalysis.from_file(file_path, group="main")
                    
                    # Ensure we got valid numbers
                    loc = analysis.code_count + analysis.documentation_count + analysis.empty_count
                    nloc = analysis.code_count
                    file_metrics = FileMetrics(
                        filename=f"{relative_path}\n({analysis.language})",
                        total_loc=loc,
                        total_nloc=nloc,
                        function_count=0,
                        total_complexity=0, # Complexity not available from pygount
                        complexity_max=0,
                        functions=[],
                        is_unsupported=True
                    )
                except Exception as e:
                    # Fallback if pygount fails
                    total_lines = len(content.splitlines())
                    file_metrics = FileMetrics(
                        filename=f"{relative_path}\n(unsupported)",
                        total_loc=total_lines,
                        total_nloc=total_lines, # Assume all are code if unknown
                        function_count=0,
                        total_complexity=0,
                        complexity_max=0,
                        functions=[],
                        is_unsupported=True
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
