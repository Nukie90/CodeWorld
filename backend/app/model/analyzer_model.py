from pydantic import BaseModel

class FunctionMetric(BaseModel):
    name: str
    start_line: int
    nloc: int                     # logical LOC in function
    cyclomatic_complexity: int

class FileMetrics(BaseModel):
    filename: str
    language: str
    total_loc: int                # total lines (physical)
    total_nloc: int               # logical LOC (lizard)
    function_count: int
    complexity_avg: float
    complexity_max: int
    functions: list[FunctionMetric]

class FolderMetrics(BaseModel):
    folder_name: str
    total_files: int
    total_loc: int                # total lines across all files
    total_nloc: int               # total logical LOC across all files
    total_functions: int
    complexity_avg: float
    complexity_max: int
    files: list[FileMetrics]

class FolderAnalysisResult(BaseModel):
    folder_metrics: FolderMetrics
    individual_files: list[FileMetrics]
