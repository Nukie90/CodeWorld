import os
import asyncio
import tempfile
from typing import List, Optional, Callable
import pygount
from app.adapter.factory import get_adapters
from app.model.analyzer_model import FileMetrics, FolderMetrics, FolderAnalysisResult
from app.utils.ignore import build_ignore_checker
from app.utils.analysis_helpers import aggregate_metrics, run_adapter_batches, group_files_by_adapter


def _build_unsupported_file_metrics(relative_path: str, total_loc: int, total_lloc: int, language: str) -> FileMetrics:
    return FileMetrics(
        filename=relative_path,
        language=language,
        total_loc=total_loc,
        total_lloc=total_lloc,
        function_count=0,
        total_complexity=0,
        functions=[],
        is_unsupported=True,
    )


def _analyze_with_pygount(file_path: str, relative_path: str, content: Optional[str] = None) -> Optional[FileMetrics]:
    try:
        target_path = file_path
        temp_path = None

        if not os.path.exists(file_path):
            suffix = os.path.splitext(relative_path)[1]
            with tempfile.NamedTemporaryFile("w", suffix=suffix, delete=False, encoding="utf-8") as temp_file:
                temp_file.write(content or "")
                temp_path = temp_file.name
                target_path = temp_path

        analysis = pygount.SourceAnalysis.from_file(target_path, group="main")
        loc = analysis.code_count + analysis.documentation_count + analysis.empty_count
        if loc == 0 and content is not None:
            return None
        return _build_unsupported_file_metrics(
            relative_path=relative_path,
            total_loc=loc,
            total_lloc=analysis.code_count,
            language=analysis.language,
        )
    except Exception:
        return None
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)


def _analyze_single_file(file_path: str, relative_path: str,
                          content_override: Optional[str] = None) -> Optional[FileMetrics]:
    """Analyze a single file and return FileMetrics, or None on failure."""
    try:
        if content_override is not None:
            content = content_override
        else:
            with open(file_path, "r", encoding="utf-8", errors="replace") as f:
                content = f.read()

        adapters = get_adapters()
        supported_adapter = next((a for a in adapters if a.supports(relative_path)), None)

        if supported_adapter:
            return asyncio.run(supported_adapter.analyze_content(content, relative_path))
        else:
            pygount_metrics = _analyze_with_pygount(file_path, relative_path, content)
            if pygount_metrics is not None:
                return pygount_metrics

            total_lines = len(content.splitlines())
            return _build_unsupported_file_metrics(
                relative_path=relative_path,
                total_loc=total_lines,
                total_lloc=total_lines,
                language="unsupported",
            )
    except Exception as e:
        print(f"Skipping file {relative_path} due to error: {e}")
        return None

def _scan_directory(path: str, is_ignored: Callable) -> List[tuple[str, str]]:
    """Recursively scan directory for files that are not ignored."""
    all_files = []
    for root, dirs, files in os.walk(path):
        dirs[:] = [d for d in dirs if not is_ignored(os.path.join(root, d))]
        for file in files:
            file_path = os.path.join(root, file)
            if is_ignored(file_path):
                continue
            relative_path = os.path.relpath(file_path, path).replace(os.path.sep, '/')
            all_files.append((file_path, relative_path))
    return all_files

def _carry_over_unchanged_files(previous_analysis: FolderAnalysisResult, 
                               changed_set: set, deleted_set: set) -> List[FileMetrics]:
    """Identify unchanged files from previous analysis and carry them forward."""
    prev_map: dict[str, FileMetrics] = {}
    for m in previous_analysis.individual_files:
        clean_name = m.filename.split('\n')[0]
        prev_map[clean_name] = m
    
    return [m for clean_name, m in prev_map.items() 
            if clean_name not in changed_set and clean_name not in deleted_set]

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
    # Build ignore checker to filter out ignored files
    is_ignored = build_ignore_checker(local_path)
    
    # Filter files before processing
    valid_deleted = [f for f in (deleted_files or []) if not is_ignored(os.path.join(local_path, f))]
    valid_changed = [f for f in (changed_files or []) if not is_ignored(os.path.join(local_path, f))]
    
    deleted_set = set(valid_deleted)
    changed_set = set(valid_changed)

    file_metrics_list = _carry_over_unchanged_files(previous_analysis, changed_set, deleted_set)

    # 2. Analyze ONLY the changed/added files
    adapters = get_adapters()

    def get_content(rel_path):
        if file_contents_override and rel_path in file_contents_override:
            return file_contents_override[rel_path]
        abs_path = os.path.join(local_path, rel_path.replace('/', os.sep))
        if os.path.exists(abs_path):
             try:
                 with open(abs_path, "r", encoding="utf-8", errors="replace") as f:
                     return f.read()
             except Exception:
                 pass
        return None

    grouped_files, unsupported_files = group_files_by_adapter(
        valid_changed, adapters, get_content, deleted_set
    )

    # Batch analyze files per adapter
    batch_results = asyncio.run(run_adapter_batches(grouped_files))
    file_metrics_list.extend(batch_results)

    # Analyze unsupported files (pygount)
    for rel_path, content in unsupported_files:
        abs_path = os.path.join(local_path, rel_path.replace('/', os.sep))
        fm = _analyze_single_file(abs_path, rel_path, content_override=content)
        if fm is not None:
            file_metrics_list.append(fm)

    folder_metrics = aggregate_metrics(file_metrics_list, os.path.basename(local_path))
    return FolderAnalysisResult(folder_metrics=folder_metrics, individual_files=file_metrics_list)



def _full_analysis(
    path: str,
    progress_callback: Optional[Callable] = None,
) -> FolderAnalysisResult:
    """Perform a complete analysis of a local folder."""
    if progress_callback:
        progress_callback(35, "Scanning directory structure")

    all_files = _scan_directory(path, build_ignore_checker(path))
    num_files = len(all_files)

    if progress_callback:
        progress_callback(40, f"Starting analysis of {num_files} files")

    adapters = get_adapters()
    rel_paths = [f[1] for f in all_files]

    def get_content(rel_path):
        target = next((f[0] for f in all_files if f[1] == rel_path), None)
        if target and os.path.exists(target):
            try:
                with open(target, "r", encoding="utf-8", errors="replace") as f:
                    return f.read()
            except Exception as e:
                print(f"Skipping file {rel_path}: {e}")
        return None

    grouped_files, unsupported_files_with_content = group_files_by_adapter(
        rel_paths, adapters, get_content
    )

    if progress_callback:
        progress_callback(45, "Batch analyzing plugin files")

    file_metrics_list = asyncio.run(run_adapter_batches(grouped_files))

    if progress_callback:
        progress_callback(70, "Analyzing pygount fallback files")

    for rel_path, content in unsupported_files_with_content:
        abs_path = os.path.join(path, rel_path.replace('/', os.sep))
        fm = _analyze_single_file(abs_path, rel_path, content_override=content)
        if fm is not None:
            file_metrics_list.append(fm)

    if progress_callback:
        progress_callback(95, "Aggregating metrics")

    folder_metrics = aggregate_metrics(file_metrics_list, os.path.basename(path))
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

    if previous_analysis is not None and changed_files is not None:
        if not changed_files and not deleted_files:
            if progress_callback:
                progress_callback(95, "No actionable changes, returning cached analysis")
            return previous_analysis

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

    return _full_analysis(path, progress_callback)
