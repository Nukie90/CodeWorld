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