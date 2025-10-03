from fastapi.responses import JSONResponse
import lizard
from app.model.analyzer_model import FileMetrics, FunctionMetric

def analyze_js(code: str, filename: str) -> FileMetrics:
    result = lizard.analyze_file.analyze_source_code(filename, code)

    funcs = []
    cc_sum = 0
    cc_max = 0

    for f in result.function_list:
        # Skip invalid / placeholder function names
        if not f.name or not f.name.isidentifier():
            continue

        cc = int(f.cyclomatic_complexity)
        nloc = int(f.nloc)

        funcs.append(FunctionMetric(
            name=f.name,
            start_line=int(f.start_line),
            nloc=nloc,
            cyclomatic_complexity=cc
        ))
        cc_sum += cc
        cc_max = max(cc_max, cc)

    function_count = len(funcs)
    complexity_avg = round(cc_sum / function_count, 2) if function_count else 0.0

    total_loc = len(code.splitlines())
    total_nloc = int(result.nloc)

    return FileMetrics(
        filename=filename,
        language="JavaScript/JSX",
        total_loc=total_loc,
        total_nloc=total_nloc,
        function_count=function_count,
        complexity_avg=complexity_avg,
        complexity_max=cc_max,
        functions=funcs
    )