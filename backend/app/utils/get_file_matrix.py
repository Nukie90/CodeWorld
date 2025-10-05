

from app.model.analyzer_model import FileMetrics, FunctionMetric
import lizard

def get_file_matrix(code: str, filename: str) -> FileMetrics:
    """
    Use Lizard directly on source text. 
    IMPORTANT: Do not hard-filter function names (keep "(anonymous)", "&&", "?").
    This preserves parity for JS/JSX where anonymous functions are common.
    """
    result = lizard.analyze_file.analyze_source_code(filename, code)

    funcs: list[FunctionMetric] = []
    cc_sum = 0
    cc_max = 0

    for f in result.function_list:
    #     self.cyclomatic_complexity = ccn
    #     self.nloc = 1
    #     self.token_count = 1  # the first token
    #     self.name = name
    #     self.long_name = name
    #     self.start_line = start_line
    #     self.end_line = start_line
    #     self.full_parameters = []
    #     self.filename = filename
    #     self.top_nesting_level = -1
    #     self.fan_in = 0
    #     self.fan_out = 0
    #     self.general_fan_out = 0
    #     self.max_nesting_depth = 0  # Initialize max_nesting_depth to 0
        cc = int(f.cyclomatic_complexity)
        nloc = int(f.nloc)
        funcs.append(FunctionMetric(
            cyclomatic_complexity=int(f.cyclomatic_complexity),
            nloc=nloc,
            token_count=int(f.token_count),
            name=f.name,                  # may be "(anonymous)" and that’s okay
            long_name=f.long_name,
            start_line=int(f.start_line),
            end_line=int(f.end_line),
            max_nesting_depth=int(f.max_nesting_depth),
        ))
        cc_sum += cc
        if cc > cc_max:
            cc_max = cc

    function_count = len(funcs)
    complexity_avg = round(cc_sum / function_count, 2) if function_count else 0.0

    return FileMetrics(
        filename=filename,
        language=getattr(result, "language", None),
        total_loc=int(getattr(result, "nloc", 0) + getattr(result, "comment_lines", 0)),
        total_nloc=int(getattr(result, "nloc", 0)),
        function_count=function_count,
        complexity_avg=complexity_avg,
        complexity_max=cc_max,
        functions=funcs
    )
