# models.py
from pydantic import BaseModel
from typing import List, Optional

class FunctionMetric(BaseModel):
    name: str
    start_line: Optional[int]
    nloc: int
    cyclomatic_complexity: int

class FileMetrics(BaseModel):
    filename: str
    language: Optional[str]
    total_loc: int
    total_nloc: int
    function_count: int
    complexity_avg: float
    complexity_max: int
    functions: List[FunctionMetric]

class FolderMetrics(BaseModel):
    folder_name: str
    total_files: int
    total_loc: int
    total_nloc: int
    total_functions: int
    complexity_avg: float
    complexity_max: int
    files: List[FileMetrics]

class FolderAnalysis(BaseModel):
    folder_name: str
    analysis: dict

class FolderAnalysisResult(BaseModel):
    folder_metrics: FolderMetrics
    individual_files: list[FileMetrics]

class CodeRequest(BaseModel):
    filename: str = "snippet.jsx"
    code: str