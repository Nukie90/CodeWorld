import os
import asyncio
from typing import List, Tuple, Optional, Dict
from app.model.analyzer_model import FileMetrics, FolderMetrics, FolderAnalysisResult, FunctionMetric
from app.adapter.adapter import AnalysisAdapter


def _ensure_function_total_cognitive_complexity(function_metric: FunctionMetric) -> int:
    child_sum = sum(_ensure_function_total_cognitive_complexity(child) for child in function_metric.children)
    base_cc = function_metric.cognitive_complexity or 0
    total_cc = base_cc + child_sum
    function_metric.total_cognitive_complexity = total_cc
    return total_cc


def ensure_file_total_cognitive_complexity(file_metrics: FileMetrics) -> FileMetrics:
    if file_metrics.total_cognitive_complexity is not None:
        return file_metrics

    roots = [fn for fn in file_metrics.functions if fn.parentId is None]
    if not roots and file_metrics.functions:
        roots = file_metrics.functions

    file_metrics.total_cognitive_complexity = sum(
        _ensure_function_total_cognitive_complexity(fn) for fn in roots
    )
    return file_metrics


def normalize_analysis_result(analysis: FolderAnalysisResult) -> FolderAnalysisResult:
    for file_metrics in analysis.individual_files:
        ensure_file_total_cognitive_complexity(file_metrics)
    return analysis

def aggregate_metrics(file_metrics_list: List[FileMetrics], folder_name: str) -> FolderMetrics:
    """Aggregate individual file metrics into folder-level metrics."""
    total_loc = total_lloc = total_functions = total_complexity = 0
    halstead_volume = 0.0
    total_mi = 0.0
    valid_mi_files = 0

    for fm in file_metrics_list:
        total_loc += fm.total_loc or 0
        total_lloc += fm.total_lloc or 0
        total_functions += fm.function_count or 0
        total_complexity += fm.total_complexity or 0
        if getattr(fm, 'halstead_volume', None) is not None:
            halstead_volume += fm.halstead_volume
        if getattr(fm, 'maintainability_index', None) is not None:
            total_mi += fm.maintainability_index
            valid_mi_files += 1

    return FolderMetrics(
        folder_name=folder_name,
        total_files=len(file_metrics_list),
        total_loc=total_loc,
        total_lloc=total_lloc,
        total_functions=total_functions,
        total_complexity=total_complexity,
        halstead_volume=halstead_volume,
        maintainability_index=round(total_mi / valid_mi_files, 2) if valid_mi_files > 0 else None,
        files=file_metrics_list,
    )

async def run_adapter_batches(grouped_files: Dict[int, Tuple[AnalysisAdapter, List[Tuple[str, str]]]]) -> List[FileMetrics]:
    """Run batch analysis for each adapter and return flattened results."""
    all_results = []
    # We can run all adapters in parallel
    tasks = []
    for adapter, files in grouped_files.values():
        if files:
            tasks.append(adapter.analyze_batch(files))
    
    if tasks:
        adapter_results = await asyncio.gather(*tasks)
        for batch in adapter_results:
            all_results.extend([fm for fm in batch if fm is not None])
    
    return all_results

def group_files_by_adapter(rel_paths: List[str], adapters: List[AnalysisAdapter], 
                          get_content_fn, deleted_set: set = None) -> Tuple[Dict[int, Tuple[AnalysisAdapter, List[Tuple[str, str]]]], List[Tuple[str, str]]]:
    """Group files by their supporting adapter or mark as unsupported.
    get_content_fn should be a callable that takes rel_path and returns content string or None.
    """
    if deleted_set is None:
        deleted_set = set()
        
    grouped_files = {id(a): (a, []) for a in adapters}
    unsupported_files = []

    for rel_path in rel_paths:
        if rel_path in deleted_set:
            continue
            
        content = get_content_fn(rel_path)
        if content is None:
            continue

        supported_adapter = next((a for a in adapters if a.supports(rel_path)), None)
        if supported_adapter:
            grouped_files[id(supported_adapter)][1].append((content, rel_path))
        else:
            unsupported_files.append((rel_path, content))
            
    return grouped_files, unsupported_files
