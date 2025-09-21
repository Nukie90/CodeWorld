from fastapi.responses import JSONResponse
import lizard
from app.model.analyzer_model import FileMetrics, FunctionMetric

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