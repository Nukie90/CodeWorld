from typing import List, Tuple, Optional
from app.model.analyzer_model import FileMetrics, FunctionMetric, FolderMetrics, FolderAnalysisResult
from app.utils.ignore import build_ignore_checker
from app.adapter.factory import get_adapters
from app.adapter.adapter import AnalysisAdapter
import os
import io
import zipfile
import tempfile
from anyio import Path

def _collect_files(temp_dir: str) -> List[Tuple[str, str]]:
    """Recursively find all non-ignored files in the directory."""
    all_files = []
    is_ignored = build_ignore_checker(temp_dir)

    for root, dirs, files in os.walk(temp_dir):
        # Filter directories in-place to skip ignored ones
        dirs[:] = [d for d in dirs if not is_ignored(os.path.join(root, d))]
        
        for file in files:
            file_path = os.path.join(root, file)
            if is_ignored(file_path):
                continue
            relative_path = os.path.relpath(file_path, temp_dir)
            all_files.append((file_path, relative_path))
            
    return all_files

async def _analyze_file(file_path: str, relative_path: str, adapters: List[AnalysisAdapter]) -> Optional[FileMetrics]:
    """Analyze a single file using the appropriate adapter."""
    try:
        content = await Path(file_path).read_text(encoding='utf-8')
        
        for adapter in adapters:
            if adapter.supports(relative_path):
                return await adapter.analyze_content(content, relative_path)
                
    except Exception as e:
        # Skip files that can't be read or analyzed
        print(f"Error analyzing {relative_path}: {e}")
        
    return None

async def get_folder_matrix(zip_content: bytes, folder_name: str) -> FolderAnalysisResult:
    """Analyze a folder uploaded as a zip file"""
    
    # Create temporary directory to extract files
    with tempfile.TemporaryDirectory() as temp_dir:
        # Extract zip file
        with zipfile.ZipFile(io.BytesIO(zip_content), 'r') as zip_ref:
            zip_ref.extractall(temp_dir)
        
        # Find all files
        all_files = _collect_files(temp_dir)
        
        # Initialize Metrics
        file_metrics_list: List[FileMetrics] = []
        total_loc = 0
        total_nloc = 0
        total_functions = 0
        total_complexity = 0
        complexity_max = 0
        
        # Get list of adapters
        adapters = get_adapters()

        for file_path, relative_path in all_files:
            file_metrics = await _analyze_file(file_path, relative_path, adapters)

            if file_metrics:
                file_metrics_list.append(file_metrics)
                
                # Aggregate folder metrics
                total_loc += file_metrics.total_loc
                total_nloc += file_metrics.total_nloc
                total_functions += file_metrics.function_count
                
                # Ensure complexity_avg is treated as a number
                total_complexity += file_metrics.total_complexity
                
                if file_metrics.complexity_max > complexity_max:
                    complexity_max = file_metrics.complexity_max
        
        folder_metrics = FolderMetrics(
            folder_name=folder_name,
            total_files=len(file_metrics_list),
            total_loc=total_loc,
            total_nloc=total_nloc,
            total_functions=total_functions,
            total_complexity=total_complexity,
            complexity_max=complexity_max,
            files=file_metrics_list
        )
        
        return FolderAnalysisResult(
            folder_metrics=folder_metrics,
            individual_files=file_metrics_list
        )
