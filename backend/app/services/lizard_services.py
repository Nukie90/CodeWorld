from fastapi.responses import JSONResponse
import lizard
import tempfile
import os
import zipfile
import io
from typing import List
from app.model.analyzer_model import FileMetrics, FunctionMetric, FolderMetrics, FolderAnalysisResult

def analyze_js(code: str, filename: str) -> FileMetrics:
    # lizard supports analyzing source strings
    result = lizard.analyze_file.analyze_source_code(filename, code)

    # Aggregate
    funcs = []
    cc_sum = 0
    cc_max = 0
    for f in result.function_list:
        cc = int(f.cyclomatic_complexity)
        nloc = int(f.nloc)
        if f.name in ("(anonymous)", "&&", "?"):
            continue
        else:
            funcs.append(FunctionMetric(
            name=f.name,
            start_line=int(f.start_line),
            nloc=nloc,
            cyclomatic_complexity=cc
        ))
        cc_sum += cc
        if cc > cc_max:
            cc_max = cc

    function_count = len(funcs)
    complexity_avg = round(cc_sum / function_count, 2) if function_count else 0.0

    # lizard gives:
    #  - nloc: logical LOC
    #  - result.nloc: total logical LOC for file
    # It does not track physical LOC, we can compute simple physical LOC:
    total_loc = len(code.splitlines())
    total_nloc = int(result.nloc)

    return FileMetrics(
        filename=filename,
        language="JavaScript",
        total_loc=total_loc,
        total_nloc=total_nloc,
        function_count=function_count,
        complexity_avg=complexity_avg,
        complexity_max=cc_max,
        functions=funcs
    )

def analyze_folder(zip_content: bytes, folder_name: str) -> FolderAnalysisResult:
    """Analyze a folder uploaded as a zip file"""
    
    # Create temporary directory to extract files
    with tempfile.TemporaryDirectory() as temp_dir:
        # Extract zip file
        with zipfile.ZipFile(io.BytesIO(zip_content), 'r') as zip_ref:
            zip_ref.extractall(temp_dir)
        
        # Find all JS/JSX files
        js_files = []
        for root, dirs, files in os.walk(temp_dir):
            for file in files:
                if file.lower().endswith(('.js', '.jsx')):
                    file_path = os.path.join(root, file)
                    relative_path = os.path.relpath(file_path, temp_dir)
                    js_files.append((file_path, relative_path))
        
        # Analyze each file
        file_metrics_list: List[FileMetrics] = []
        total_loc = 0
        total_nloc = 0
        total_functions = 0
        complexity_sum = 0
        complexity_max = 0
        
        for file_path, relative_path in js_files:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                file_metrics = analyze_js(content, relative_path)
                file_metrics_list.append(file_metrics)
                
                # Aggregate folder metrics
                total_loc += file_metrics.total_loc
                total_nloc += file_metrics.total_nloc
                total_functions += file_metrics.function_count
                complexity_sum += file_metrics.complexity_avg * file_metrics.function_count
                if file_metrics.complexity_max > complexity_max:
                    complexity_max = file_metrics.complexity_max
                    
            except Exception as e:
                # Skip files that can't be read or analyzed
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
