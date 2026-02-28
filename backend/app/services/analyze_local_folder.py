import os
from typing import List, Optional, Callable
import pygount
from app.utils.get_file_matrix_js import get_file_matrix_js_batch
from app.python_plugin.python_analyzer import calculate_metrics as get_file_matrix_python
from app.model.analyzer_model import FileMetrics, FolderMetrics, FolderAnalysisResult
from app.utils.ignore import build_ignore_checker


JS_EXTENSIONS = ('.js', '.jsx', '.ts', '.tsx')
PYTHON_EXTENSION = '.py'


def _analyze_single_file(file_path: str, relative_path: str,
                          content_override: Optional[str] = None) -> Optional[FileMetrics]:
    """Analyze a single file and return FileMetrics, or None on failure."""
    try:
        if content_override is not None:
            content = content_override
        else:
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()

        ext = os.path.splitext(relative_path)[1].lower()

        if ext in JS_EXTENSIONS:
            # Will be handled by batch — should not be called directly for JS in normal flow
            from app.utils.get_file_matrix_js import get_file_matrix_js
            return get_file_matrix_js(content, relative_path)
        elif ext == PYTHON_EXTENSION:
            return get_file_matrix_python(content, relative_path)
        else:
            # pygount only works on real files; if we have a content override, count lines
            if content_override is not None:
                total_lines = len(content.splitlines())
                return FileMetrics(
                    filename=f"{relative_path}\n(unsupported)",
                    total_loc=total_lines, total_nloc=total_lines,
                    function_count=0, total_complexity=0, complexity_max=0,
                    functions=[], is_unsupported=True
                )
            try:
                analysis = pygount.SourceAnalysis.from_file(file_path, group="main")
                loc = analysis.code_count + analysis.documentation_count + analysis.empty_count
                return FileMetrics(
                    filename=f"{relative_path}\n({analysis.language})",
                    total_loc=loc, total_nloc=analysis.code_count,
                    function_count=0, total_complexity=0, complexity_max=0,
                    functions=[], is_unsupported=True
                )
            except Exception:
                total_lines = len(content.splitlines())
                return FileMetrics(
                    filename=f"{relative_path}\n(unsupported)",
                    total_loc=total_lines, total_nloc=total_lines,
                    function_count=0, total_complexity=0, complexity_max=0,
                    functions=[], is_unsupported=True
                )
    except Exception as e:
        print(f"Skipping file {relative_path} due to error: {e}")
        return None


def _incremental_analysis(
    local_path: str,
    previous_analysis: FolderAnalysisResult,
    changed_files: List[str],
    deleted_files: Optional[List[str]] = None,
    file_contents_override: Optional[dict] = None,
) -> FolderAnalysisResult:
    """
    Fast incremental analysis: does NOT use os.walk.
    Builds result from:
      - previous_analysis for unchanged files
      - fresh analysis (via git object content) for changed files
      - excludes deleted files
    """
    deleted_set = set(deleted_files or [])
    changed_set = set(changed_files or [])

    # Build lookup of previous file metrics (strip language suffix from key)
    prev_map: dict[str, FileMetrics] = {}
    for m in previous_analysis.individual_files:
        clean_name = m.filename.split('\n')[0]
        prev_map[clean_name] = m

    file_metrics_list: List[FileMetrics] = []

    # 1. Carry over all unchanged, non-deleted previous files
    for clean_name, m in prev_map.items():
        if clean_name not in changed_set and clean_name not in deleted_set:
            file_metrics_list.append(m)

    # 2. Analyze ONLY the changed/added files
    js_to_analyze: List[tuple] = []  # (content, relative_path)
    non_js_to_analyze: List[tuple] = []  # (relative_path, content_or_None)

    for rel_path in changed_files:
        if rel_path in deleted_set:
            continue  # deleted — skip
        content = None
        if file_contents_override:
            content = file_contents_override.get(rel_path)
        if content is None:
            # Try reading from disk as fallback
            abs_path = os.path.join(local_path, rel_path.replace('/', os.sep))
            if os.path.exists(abs_path):
                try:
                    with open(abs_path, "r", encoding="utf-8", errors="replace") as f:
                        content = f.read()
                except Exception:
                    pass
        if content is None:
            continue  # Can't get content — skip

        ext = os.path.splitext(rel_path)[1].lower()
        if ext in JS_EXTENSIONS:
            js_to_analyze.append((content, rel_path))
        else:
            non_js_to_analyze.append((rel_path, content))

    # Batch analyze JS files in one call
    if js_to_analyze:
        results = get_file_matrix_js_batch(js_to_analyze)
        for fm in results:
            if fm is not None:
                file_metrics_list.append(fm)

    # Analyze non-JS changed files
    for rel_path, content in non_js_to_analyze:
        abs_path = os.path.join(local_path, rel_path.replace('/', os.sep))
        fm = _analyze_single_file(abs_path, rel_path, content_override=content)
        if fm is not None:
            file_metrics_list.append(fm)

    # 3. Aggregate metrics
    total_loc = total_nloc = total_functions = total_complexity = complexity_max = 0
    for fm in file_metrics_list:
        total_loc += fm.total_loc
        total_nloc += fm.total_nloc
        total_functions += fm.function_count
        total_complexity += fm.total_complexity
        if (fm.complexity_max or 0) > complexity_max:
            complexity_max = fm.complexity_max

    folder_metrics = FolderMetrics(
        folder_name=os.path.basename(local_path),
        total_files=len(file_metrics_list),
        total_loc=total_loc, total_nloc=total_nloc,
        total_functions=total_functions, total_complexity=total_complexity,
        complexity_max=complexity_max, files=file_metrics_list,
    )
    return FolderAnalysisResult(folder_metrics=folder_metrics, individual_files=file_metrics_list)


def analyze_local_folder(
    path: str,
    progress_callback: Optional[Callable] = None,
    previous_analysis: Optional[FolderAnalysisResult] = None,
    changed_files: Optional[List[str]] = None,
    deleted_files: Optional[List[str]] = None,
    file_contents_override: Optional[dict] = None,
) -> FolderAnalysisResult:
    """Analyze a local folder on disk and return folder analysis result."""

    # ---- Fast incremental path (used during timeline playback) ----
    # When we have a previous cached analysis and know exactly which files changed,
    # skip os.walk entirely and build the result from the cache + fresh analysis.
    if previous_analysis is not None and changed_files is not None:
        if progress_callback:
            progress_callback(50, f"Incremental: re-analyzing {len(changed_files)} changed file(s)")
        result = _incremental_analysis(
            path, previous_analysis, changed_files,
            deleted_files=deleted_files,
            file_contents_override=file_contents_override,
        )
        if progress_callback:
            progress_callback(95, "Done")
        return result

    # ---- Full analysis path (first commit, branch checkout, etc.) ----
    all_files = []
    is_ignored = build_ignore_checker(path)

    if progress_callback:
        progress_callback(35, "Scanning directory structure")

    for root, dirs, files in os.walk(path):
        dirs[:] = [d for d in dirs if not is_ignored(os.path.join(root, d))]
        for file in files:
            file_path = os.path.join(root, file)
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
    total_mi = 0.0
    valid_mi_files = 0

    num_files = len(all_files)

    if progress_callback:
        progress_callback(40, f"Starting analysis of {num_files} files")

    # Separate into JS and non-JS for efficient batch handling
    js_to_analyze: List[tuple] = []   # (content, relative_path)
    non_js: List[tuple] = []          # (file_path, relative_path)

    for file_path, relative_path in all_files:
        ext = os.path.splitext(relative_path)[1].lower()
        if ext in JS_EXTENSIONS:
            try:
                with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                    content = f.read()
                js_to_analyze.append((content, relative_path))
            except Exception as e:
                print(f"Skipping JS file {relative_path}: {e}")
        else:
            non_js.append((file_path, relative_path))

    if progress_callback:
        progress_callback(45, f"Batch analyzing {len(js_to_analyze)} JS/TS files")

    # Batch all JS files in one HTTP call
    if js_to_analyze:
        results = get_file_matrix_js_batch(js_to_analyze)
        for fm in results:
            if fm is not None:
                file_metrics_list.append(fm)

    if progress_callback:
        progress_callback(70, "Analyzing Python / other files")

    # Analyze non-JS files
    for file_path, relative_path in non_js:
        fm = _analyze_single_file(file_path, relative_path)
        if fm is not None:
            file_metrics_list.append(fm)

    if progress_callback:
        progress_callback(95, "Aggregating metrics")

    total_loc = total_nloc = total_functions = total_complexity = complexity_max = 0
    total_mi = 0.0
    valid_mi_files = 0
    for fm in file_metrics_list:
        total_loc += fm.total_loc
        total_nloc += fm.total_nloc
        total_functions += fm.function_count
        total_complexity += fm.total_complexity
        if (fm.complexity_max or 0) > complexity_max:
            complexity_max = fm.complexity_max
        if getattr(fm, 'maintainability_index', None) is not None:
            total_mi += fm.maintainability_index
            valid_mi_files += 1

    folder_metrics = FolderMetrics(
        folder_name=os.path.basename(path),
        total_files=len(file_metrics_list),
        total_loc=total_loc,
        total_nloc=total_nloc,
        total_functions=total_functions,
        total_complexity=total_complexity,
        complexity_max=complexity_max,
        maintainability_index=round(total_mi / valid_mi_files, 2) if valid_mi_files > 0 else None,
        files=file_metrics_list,
    )
    return FolderAnalysisResult(folder_metrics=folder_metrics, individual_files=file_metrics_list)
