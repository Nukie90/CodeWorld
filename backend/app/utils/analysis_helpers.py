import os
import asyncio
from typing import List, Tuple, Optional, Dict
from app.model.analyzer_model import FileMetrics, FolderMetrics
from app.adapter.adapter import AnalysisAdapter

def aggregate_metrics(file_metrics_list: List[FileMetrics], folder_name: str) -> FolderMetrics:
    """Aggregate individual file metrics into folder-level metrics."""
    total_loc = total_lloc = total_functions = total_complexity = complexity_max = 0
    halstead_volume = 0.0
    total_mi = 0.0
    valid_mi_files = 0

    for fm in file_metrics_list:
        total_loc += fm.total_loc or 0
        total_lloc += fm.total_lloc or 0
        total_functions += fm.function_count or 0
        total_complexity += fm.total_complexity or 0
        if (fm.complexity_max or 0) > complexity_max:
            complexity_max = fm.complexity_max or 0
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
        complexity_max=complexity_max,
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
