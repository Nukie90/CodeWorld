# models.py
from pydantic import BaseModel, Field
from typing import List, Optional

class FunctionMetric(BaseModel):
    name: str
    long_name: str
    start_line: Optional[int] = None
    end_line: Optional[int] = None
    nloc: int
    cognitive_complexity: Optional[int] = None
    cyclomatic_complexity: Optional[int] = None
    total_cognitive_complexity: Optional[int] = None
    maintainability_index: Optional[float] = None
    max_nesting_depth: int
    token_count: int
    id: Optional[int] = None
    parentId: Optional[int] = None
    children: List['FunctionMetric'] = Field(default_factory=list)

class FileMetrics(BaseModel):
    filename: str
    language: Optional[str] = None
    total_loc: int
    total_nloc: int
    function_count: int
    total_complexity: int
    complexity_max: int
    maintainability_index: Optional[float] = None
    is_unsupported: bool = False
    functions: List[FunctionMetric]

class FolderMetrics(BaseModel):
    folder_name: str
    total_files: int
    total_loc: int
    total_nloc: int
    total_functions: int
    total_complexity: int
    complexity_max: int
    maintainability_index: Optional[float] = None
    files: List[FileMetrics]

class FolderAnalysisResult(BaseModel):
    folder_metrics: FolderMetrics
    individual_files: List[FileMetrics]

# Rebuild the model to handle recursion
FunctionMetric.model_rebuild()