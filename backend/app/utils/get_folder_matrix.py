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

from app.utils.analysis_helpers import group_files_by_adapter, run_adapter_batches, aggregate_metrics

async def get_folder_matrix(zip_content: bytes, folder_name: str) -> FolderAnalysisResult:
    """Analyze a folder uploaded as a zip file"""
    
    # Create temporary directory to extract files
    with tempfile.TemporaryDirectory() as temp_dir:
        # Extract zip file
        with zipfile.ZipFile(io.BytesIO(zip_content), 'r') as zip_ref:
            zip_ref.extractall(temp_dir)
        
        # Find all files
        all_files = _collect_files(temp_dir)
        adapters = get_adapters()

        # Collect contents first
        file_contents = {}
        for file_path, rel_path in all_files:
            try:
                content = await Path(file_path).read_text(encoding='utf-8')
                file_contents[rel_path] = content
            except Exception as e:
                print(f"Error reading {rel_path}: {e}")

        rel_paths = [f[1] for f in all_files]
        grouped_files, _ = group_files_by_adapter(
            rel_paths, adapters, lambda r: file_contents.get(r)
        )

        # Batch analyze
        file_metrics_list = await run_adapter_batches(grouped_files)

        folder_metrics = aggregate_metrics(file_metrics_list, folder_name)
        
        return FolderAnalysisResult(
            folder_metrics=folder_metrics,
            individual_files=file_metrics_list
        )
