# models.py
from pydantic import BaseModel, Field
from typing import List, Optional, Any

class LintError(BaseModel):
    type: str
    module: str
    obj: str
    line: int
    column: int
    endLine: Optional[int] = None
    endColumn: Optional[int] = None
    path: str
    symbol: str
    message: str
    message_id: str

class FileLint(BaseModel):
    lint_score: Optional[float] = None
    lint_errors: List[LintError] = Field(default_factory=list)
    is_not_applicable: bool = False
    not_applicable_reason: Optional[str] = None

class FunctionMetric(BaseModel):
    name: str
    long_name: str
    start_line: Optional[int] = None
    end_line: Optional[int] = None
    lloc: int
    cognitive_complexity: Optional[int] = None
    cyclomatic_complexity: Optional[int] = None
    total_cognitive_complexity: Optional[int] = None
    maintainability_index: Optional[float] = None
    max_nesting_depth: int
    halstead_volume: Optional[float] = None
    id: Optional[int] = None
    parentId: Optional[int] = None
    children: List['FunctionMetric'] = Field(default_factory=list)

class FileMetrics(BaseModel):
    filename: str
    language: Optional[str] = None
    total_loc: int
    total_lloc: int
    function_count: int
    total_complexity: int
    total_cognitive_complexity: Optional[int] = None
    halstead_volume: Optional[float] = None
    maintainability_index: Optional[float] = None
    is_unsupported: bool = False
    analysis_error: Optional[str] = None
    functions: List[FunctionMetric]

class FolderMetrics(BaseModel):
    folder_name: str
    total_files: int
    total_loc: int
    total_lloc: int
    total_functions: int
    total_complexity: int
    halstead_volume: Optional[float] = None
    maintainability_index: Optional[float] = None
    files: List[FileMetrics]

class FolderAnalysisResult(BaseModel):
    folder_metrics: FolderMetrics
    individual_files: List[FileMetrics]

# Rebuild the model to handle recursion
FunctionMetric.model_rebuild()
