from typing import List
from app.model.analyzer_model import FileMetrics, FunctionMetric, FolderMetrics, FolderAnalysisResult
from app.utils.ignore import build_ignore_checker
from app.adapter.factory import get_adapters
import os
import io
import zipfile
import tempfile
from anyio import Path

# NOTE: This function's complexity is due to the aggregation logic.
# While it could be split, keeping it together for now preserves clarity of the single-pass process.
async def get_folder_matrix(zip_content: bytes, folder_name: str) -> FolderAnalysisResult:
    """Analyze a folder uploaded as a zip file"""
    
    # Create temporary directory to extract files
    with tempfile.TemporaryDirectory() as temp_dir:
        # Extract zip file
        with zipfile.ZipFile(io.BytesIO(zip_content), 'r') as zip_ref:
            zip_ref.extractall(temp_dir)
        
        # Find all files
        all_files = []
        is_ignored = build_ignore_checker(temp_dir)

        for root, dirs, files in os.walk(temp_dir):
            dirs[:] = [d for d in dirs if not is_ignored(os.path.join(root, d))]
            for file in files:
                file_path = os.path.join(root, file)
                if is_ignored(file_path):
                    continue
                relative_path = os.path.relpath(file_path, temp_dir)
                all_files.append((file_path, relative_path))
        
        # Initialize Metrics
        file_metrics_list: List[FileMetrics] = []
        total_loc = 0
        total_nloc = 0
        total_functions = 0
        complexity_sum = 0
        complexity_max = 0
        
        # Get list of adapters
        adapters = get_adapters()

        for file_path, relative_path in all_files:
            try:
                content = await Path(file_path).read_text(encoding='utf-8')

                file_metrics = None
                
                # Adapter Selection Loop
                for adapter in adapters:
                    if adapter.supports(relative_path):
                        file_metrics = await adapter.analyze_content(content, relative_path)
                        break

                if file_metrics:
                    file_metrics_list.append(file_metrics)
                    
                    # Aggregate folder metrics
                    total_loc += file_metrics.total_loc
                    total_nloc += file_metrics.total_nloc
                    total_functions += file_metrics.function_count
                    
                    # Ensure complexity_avg is treated as a number
                    c_avg = file_metrics.complexity_avg if file_metrics.complexity_avg is not None else 0
                    complexity_sum += c_avg * file_metrics.function_count
                    
                    if file_metrics.complexity_max > complexity_max:
                        complexity_max = file_metrics.complexity_max
                    
            except Exception as e:
                # Skip files that can't be read or analyzed
                print(f"Error analyzing {relative_path}: {e}")
                continue
        
        # Calculate folder-level averages
        folder_complexity_avg = round(complexity_sum / total_functions, 2) if total_functions > 0 else 0.0
        
        folder_metrics = FolderMetrics(
            folder_name=folder_name,
            total_files=len(file_metrics_list),
            total_loc=total_loc,
            total_nloc=total_nloc,
            total_functions=total_functions,
            complexity_avg=folder_complexity_avg,
            complexity_max=complexity_max,
            files=file_metrics_list
        )
        
        return FolderAnalysisResult(
            folder_metrics=folder_metrics,
            individual_files=file_metrics_list
        )
