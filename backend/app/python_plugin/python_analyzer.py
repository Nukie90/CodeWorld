import ast
import json
import math
import subprocess
import sys
import tokenize
from io import BytesIO
from pathlib import PurePath
from typing import List, Dict, Any, Optional
from app.model.analyzer_model import FileMetrics, FunctionMetric, LintError

GLOBAL_FUNC_NAME = "code outside functions"

def calculate_maintainability_index(halstead_volume: float, cyclomatic_complexity: int, loc: int) -> float:
    if loc <= 0:
        return 100.0

    log_v = math.log(halstead_volume) if halstead_volume > 0 else 0
    log_loc = math.log(loc)
    original_mi = 171 - 5.2 * log_v - 0.23 * cyclomatic_complexity - 16.2 * log_loc

    return round(max(0.0, min(100.0, original_mi * 100.0 / 171.0)), 2)

def calculate_cyclomatic_complexity(node: ast.AST, skip_nested_functions: bool = False) -> int:
    complexity = 1

    class CyclomaticVisitor(ast.NodeVisitor):
        def visit_FunctionDef(self, inner_node):
            if skip_nested_functions and inner_node is not node:
                return
            self.generic_visit(inner_node)

        def visit_AsyncFunctionDef(self, inner_node):
            if skip_nested_functions and inner_node is not node:
                return
            self.generic_visit(inner_node)

        def visit_If(self, inner_node):
            nonlocal complexity
            complexity += 1
            self.generic_visit(inner_node)

        def visit_IfExp(self, inner_node):
            nonlocal complexity
            complexity += 1
            self.generic_visit(inner_node)

        def visit_For(self, inner_node):
            nonlocal complexity
            complexity += 1
            self.generic_visit(inner_node)

        def visit_AsyncFor(self, inner_node):
            self.visit_For(inner_node)

        def visit_While(self, inner_node):
            nonlocal complexity
            complexity += 1
            self.generic_visit(inner_node)

        def visit_ExceptHandler(self, inner_node):
            nonlocal complexity
            complexity += 1
            self.generic_visit(inner_node)

        def visit_BoolOp(self, inner_node):
            nonlocal complexity
            complexity += 1
            self.generic_visit(inner_node)

    CyclomaticVisitor().visit(node)

    return complexity

def count_lloc(tokens: list, start_line: int = None, end_line: int = None, exclude_ranges: list = None) -> int:
    """Calculate Logical Lines of Code (LLOC) based on tokenize NEWLINE and semicolons to match Radon."""
    filtered_tokens = []
    for tok in tokens:
        line_no = tok.start[0]
        if start_line is not None and line_no < start_line:
            continue
        if end_line is not None and line_no > end_line:
            continue
        if exclude_ranges:
            if any(r_start <= line_no <= r_end for r_start, r_end in exclude_ranges):
                continue
        filtered_tokens.append(tok)
        
    if not filtered_tokens:
        return 0

    count = 0
    current_logical_line = []
    
    def process_logical_line(line_tokens):
        if not line_tokens: return 0
        subs = []
        cur = []
        for t in line_tokens:
            if t.type == tokenize.OP and t.string == ';':
                subs.append(cur)
                cur = []
            else:
                cur.append(t)
        subs.append(cur)
        
        c = 0
        for sub in subs:
            processed = [t for t in sub if t.type not in (tokenize.COMMENT, tokenize.NL, tokenize.NEWLINE, tokenize.ENCODING, tokenize.INDENT, tokenize.DEDENT)]
            if not processed:
                continue
            
            last_colon_idx = -1
            for i in range(len(processed) - 1, -1, -1):
                if processed[i].type == tokenize.OP and processed[i].string == ':':
                    last_colon_idx = i
                    break
            if last_colon_idx != -1:
                last_semantic = len(processed) - 1
                while last_semantic > last_colon_idx and processed[last_semantic].type == tokenize.ENDMARKER:
                    last_semantic -= 1
                if last_colon_idx == last_semantic:
                    c += 1
                else:
                    c += 2
            else:
                c_valid = [t for t in processed if t.type != tokenize.ENDMARKER]
                if c_valid:
                    c += 1
        return c

    for tok in filtered_tokens:
        if tok.type in (tokenize.NEWLINE, tokenize.ENDMARKER):
            current_logical_line.append(tok)
            count += process_logical_line(current_logical_line)
            current_logical_line = []
        else:
            current_logical_line.append(tok)
            
    if current_logical_line:
        count += process_logical_line(current_logical_line)
        
    return count

def calculate_cognitive_complexity(func_node: ast.AST, base_nesting: int = 0, function_name: str = None) -> Dict[str, int]:
    complexity = 0
    nesting = base_nesting
    max_nesting = 0

    def check_nesting():
        nonlocal max_nesting
        depth = nesting - base_nesting
        if depth > max_nesting:
            max_nesting = depth

    def add_structural():
        nonlocal complexity
        complexity += 1 + nesting

    def add_fundamental():
        nonlocal complexity
        complexity += 1

    class ComplexityVisitor(ast.NodeVisitor):
        def __init__(self):
            self.current_nesting = nesting

        def visit_FunctionDef(self, node):
            # Nested function: stop traversal (CC is per-function)
            if node is not func_node:
                return
            self.generic_visit(node)
        
        def visit_AsyncFunctionDef(self, node):
            if node is not func_node:
                return
            self.generic_visit(node)

        def visit_If(self, node):
            nonlocal complexity, nesting
            is_elif = getattr(node, "_is_elif", False)

            if is_elif:
                complexity += 1 + max(nesting - 1, 0)
            else:
                add_structural()
                nesting += 1
                check_nesting()

            self.visit(node.test)
            for stmt in node.body:
                self.visit(stmt)

            if node.orelse:
                if len(node.orelse) == 1 and isinstance(node.orelse[0], ast.If):
                    node.orelse[0]._is_elif = True
                    self.visit(node.orelse[0])
                else:
                    add_fundamental()
                    for stmt in node.orelse:
                        self.visit(stmt)

            if not is_elif:
                nesting -= 1


        def visit_For(self, node):
            nonlocal nesting
            add_structural()
            nesting += 1
            check_nesting()
            self.generic_visit(node)
            nesting -= 1
            
            if node.orelse: # for..else
                add_fundamental()

        def visit_AsyncFor(self, node):
            self.visit_For(node) # Same logic

        def visit_While(self, node):
            nonlocal nesting
            add_structural()
            nesting += 1
            check_nesting()
            self.generic_visit(node)
            nesting -= 1
            
            if node.orelse: # while..else
                add_fundamental()

        def visit_Try(self, node):
            nonlocal nesting
            # catch (except) is structural
            for handler in node.handlers:
                add_structural()
                nesting += 1
                check_nesting()
                # visit the body of the except block
                for stmt in handler.body:
                    self.visit(stmt)
                nesting -= 1
            
            # visit body and finalbody (finally) - these don't add complexity themselves usually
            for stmt in node.body:
                self.visit(stmt)
            for stmt in node.finalbody:
                self.visit(stmt)
            if node.orelse:
                for stmt in node.orelse:
                    self.visit(stmt)

        def visit_BoolOp(self, node):
            # boolean operators (and, or)
            # each sequence adds fundamental complexity
            # e.g. A and B and C -> +1 for first 'and', +1 for first 'or' break
            # Python AST flattens `A and B and C` into one BoolOp with values=[A, B, C]
            # So for N values, we have N-1 operators.
            # Cognitive Complexity: each binary boolean operator adds +1? 
            # JS: `if (op === '&&' || op === '||') ... addFundamental()`
            # Yes, for each sequence.
            
            # Simplify: +1 for the BoolOp occurrence itself? 
            # In JS it checks `if (!path.parentPath.isLogicalExpression() || path.parentPath.node.operator !== op)`
            # Since Python flattens, `A and B and C` is one node. `A and B or C` might be nested.
            # We can just add (len(values) - 1) * 1? 
            # Actually, standard CC says "sequences of binary boolean operators".
            # `A && B && C` => +1. `A && B || C` => +1 (for &&), +1 (for ||).
            # Python's BoolOp has ONE operator type (And or Or).
            # So `A and B and C` is one BoolOp(op=And). We should add +1.
            add_fundamental()
            self.generic_visit(node)
            
        def visit_IfExp(self, node):
             # Ternary: a if b else c
            nonlocal nesting
            add_structural()
            nesting += 1
            check_nesting()
            self.generic_visit(node)
            nesting -= 1
            
        def visit_Assert(self, node):
            # Not usually counted, but let's stick to Control Flow
            self.generic_visit(node)
            
        def visit_Break(self, node):
            # Break with label? Python doesn't have labeled break.
            pass
            
        def visit_Continue(self, node):
            pass
            
        def visit_Call(self, node):
            # Recursive call check
            if function_name:
                if isinstance(node.func, ast.Name) and node.func.id == function_name:
                    add_fundamental()
                elif isinstance(node.func, ast.Attribute) and node.func.attr == function_name:
                    add_fundamental()
            self.generic_visit(node)

    ComplexityVisitor().visit(func_node)
    
    return {"complexity": complexity, "max_nesting": max_nesting}


def calculate_metrics(code: str, filename: str) -> FileMetrics:
    loc = len(code.splitlines())
    try:
        tree = ast.parse(code)
    except SyntaxError:
        # Fallback for invalid syntax, or return empty metrics
        return FileMetrics(
             filename=filename,
             language="python",
             total_loc=loc,
             total_lloc=0,
             function_count=0,
             total_complexity=0,
             maintainability_index=0.0,
             functions=[]
        )

    tokens = []
    try:
        tokens = list(tokenize.tokenize(BytesIO(code.encode('utf-8')).readline))
    except tokenize.TokenError:
        pass

    # Calculate LLOC (Logical Lines of Code)
    lloc = count_lloc(tokens)
    
    # Try using radon for exact 100% parity with user's baseline for the entire file
    try:
        import radon.raw
        radon_res = radon.raw.analyze(code)
        lloc = radon_res.lloc
        loc = radon_res.loc
    except Exception:
        pass
    
    N_total = 0
    unique_tokens = set()
    for tok in tokens:
        if tok.type not in (tokenize.COMMENT, tokenize.NL, tokenize.NEWLINE, tokenize.ENDMARKER, tokenize.INDENT, tokenize.DEDENT, tokenize.ENCODING):
            if tok.string.strip():
                N_total += 1
                unique_tokens.add(tok.string)

    n_unique = len(unique_tokens)
    halstead_volume = N_total * math.log2(n_unique) if n_unique > 0 else 0

    try:
        import lizard
        lizard_info = lizard.analyze_file.analyze_source_code(filename, code)
        lizard_funcs = lizard_info.function_list
    except Exception:
        lizard_funcs = []

    functions = []
    file_cyclomatic_complexity = calculate_cyclomatic_complexity(tree)
    global_cyclomatic_complexity = calculate_cyclomatic_complexity(tree, skip_nested_functions=True)

    function_lines = set()
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            start_line = getattr(node, "lineno", None)
            end_line = getattr(node, "end_lineno", start_line)
            if start_line is None or end_line is None:
                continue
            function_lines.update(range(start_line, end_line + 1))

    global_token_texts = []
    global_token_lines = set()
    for tok in tokens:
        if tok.type in (tokenize.COMMENT, tokenize.NL, tokenize.NEWLINE, tokenize.ENDMARKER, tokenize.INDENT, tokenize.DEDENT, tokenize.ENCODING):
            continue
        if tok.start[0] in function_lines:
            continue
        if tok.string.strip():
            global_token_lines.add(tok.start[0])
            global_token_texts.append(tok.string)

    global_unique_tokens = set(global_token_texts)
    global_halstead_volume = (
        len(global_token_texts) * math.log2(len(global_unique_tokens))
        if global_unique_tokens else 0
    )
    
    # Exclude nested functions/classes from global LLOC
    func_ranges = []
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            s = getattr(node, "lineno", None)
            e = getattr(node, "end_lineno", s)
            if s and e:
                func_ranges.append((s, e))
                
    global_lloc = count_lloc(tokens, exclude_ranges=func_ranges)

    # --- 1. Analyze Global Scope (Virtual Function) ---
    # Analyze the Module node (tree) directly.
    # The visitor naturally skips nested functions (visited by recursion but complexity not added to parent if checks isolate it).
    # actually calculate_cognitive_complexity's ComplexityVisitor checks `if node is not func_node: return` for FunctionDef.
    # So if we pass `tree` (Module), it might not work if it expects a FunctionDef or similar.
    # Wait, `calculate_cognitive_complexity` uses `visit_FunctionDef` to stop traversal.
    # If we pass `Module`, it visits children. If it encounters a FunctionDef, it will enter `visit_FunctionDef`.
    # logic: `if node is not func_node: return`.
    # `func_node` is `tree`. `node` is some function. `node != tree`. So it returns.
    # This effectively ignores all function bodies, which is exactly what we want for global scope!
    
    global_res = calculate_cognitive_complexity(tree, base_nesting=0, function_name=GLOBAL_FUNC_NAME)
    
    # Global LLOC will be calculated later or we can estimate it.
    # Let's set it to 0 initially and correct it like in JS.
    
    global_metric = FunctionMetric(
        name=GLOBAL_FUNC_NAME,
        long_name=GLOBAL_FUNC_NAME,
        cognitive_complexity=global_res["complexity"],
        cyclomatic_complexity=global_cyclomatic_complexity,
        lloc=global_lloc,
        halstead_volume=global_halstead_volume,
        maintainability_index=calculate_maintainability_index(
            global_halstead_volume,
            global_cyclomatic_complexity,
            global_lloc
        ),
        start_line=1,
        end_line=len(code.splitlines()),
        max_nesting_depth=global_res["max_nesting"],
        id=-1,
        parentId=None
    )
    functions.append(global_metric)
    
    fn_halstead_map = {}
    class FunctionVisitor(ast.NodeVisitor):
        def __init__(self):
            # Parent ID stack. Start with None (no parent) for top-level functions.
            self._current_parent_id = None
            self._parent_stack = [None]
            # Stack to track structural nesting level at each function scope
            # Element is (nesting_level, is_decorator_inner)
            # Initial state: base nesting 0, not a decorator scope
            self._nesting_stack = [(0, False)] 

        def visit_FunctionDef(self, node):
            self._process_function(node)
        
        def visit_AsyncFunctionDef(self, node):
            self._process_function(node)

        def _is_decorator_eligible(self, node: ast.FunctionDef) -> bool:
            """
            Check if a function matches the decorator exception pattern:
            It must contain ONLY a nested function and a return statement.
            Excludes docs/comments.
            """
            
            non_empty_stmts = []
            for stmt in node.body:
                if isinstance(stmt, ast.Expr) and (isinstance(stmt.value, ast.Str) or isinstance(stmt.value, ast.Constant)):
                     # Docstring or constant expression -> ignore
                     continue
                if isinstance(stmt, ast.Pass):
                    continue
                non_empty_stmts.append(stmt)
            
            if len(non_empty_stmts) != 2:
                return False
                
            has_func = isinstance(non_empty_stmts[0], (ast.FunctionDef, ast.AsyncFunctionDef)) or \
                       isinstance(non_empty_stmts[1], (ast.FunctionDef, ast.AsyncFunctionDef))
            has_ret = isinstance(non_empty_stmts[0], ast.Return) or \
                      isinstance(non_empty_stmts[1], ast.Return)
                      
            return has_func and has_ret

        def visit_If(self, node):
            self.generic_visit(node)

        def _process_function(self, node):
            name = node.name
            start_line = node.lineno
            end_line = node.end_lineno if hasattr(node, 'end_lineno') else start_line

            # Determine parent nesting
            parent_nesting, parent_is_decorator = self._nesting_stack[-1]
            
            if parent_is_decorator:
                base_nesting = 0 # Exception applied!
            else:
                 # Standard increment for being a nested function
                 if len(self._nesting_stack) == 1:
                     base_nesting = 0
                 else:
                     base_nesting = parent_nesting + 1

            # Calculate metrics
            res = calculate_cognitive_complexity(node, base_nesting=base_nesting, function_name=name)
            
            # Python tokens calculation for function Halstead
            fn_tokens = [tok for tok in tokens if start_line <= tok.start[0] <= end_line and tok.type not in (tokenize.COMMENT, tokenize.NL, tokenize.NEWLINE, tokenize.ENDMARKER, tokenize.INDENT, tokenize.DEDENT, tokenize.ENCODING)]
            n_fn = len([t for t in fn_tokens if t.string.strip()])
            unique_fn_tokens = {t.string for t in fn_tokens if t.string.strip()}
            n_unique_fn = len(unique_fn_tokens)
            fn_halstead_map[start_line] = n_fn * math.log2(n_unique_fn) if n_unique_fn > 0 else 0
            
            # LLOC calculation
            func_lloc = count_lloc(tokens, start_line=start_line, end_line=end_line, 
                                   exclude_ranges=[(n.lineno, n.end_lineno) for n in ast.walk(node) 
                                                   if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)) and n is not node])

            functions.append(FunctionMetric(
                name=name,
                long_name=name,
                cognitive_complexity=res["complexity"],
                cyclomatic_complexity=0, # Will be set via lizard
                lloc=func_lloc,
                halstead_volume=fn_halstead_map.get(start_line, 0.0),
                start_line=start_line,
                end_line=end_line,
                max_nesting_depth=res["max_nesting"],
                id=start_line,
                parentId=self._current_parent_id
            ))
            
            # Push state for children
            is_me_decorator = self._is_decorator_eligible(node)
            self._nesting_stack.append((base_nesting, is_me_decorator))
            
            self._current_parent_id = start_line
            self._parent_stack.append(start_line)
            
            self.generic_visit(node)
            
            self._parent_stack.pop()
            self._current_parent_id = self._parent_stack[-1] # Stack always has at least -1
            self._nesting_stack.pop()

    FunctionVisitor().visit(tree)
    
    # Map lizard functions to AST functions for cyclomatic_complexity
    for f in functions:
        if f.id == -1: 
            # Global metric handled already
            continue
            
        best_match = None
        min_dist = float('inf')
        for lf in lizard_funcs:
            if lf.name == f.name:
                dist = abs(lf.start_line - (f.start_line or 0))
                if dist < min_dist:
                    min_dist = dist
                    best_match = lf
                    
        if best_match:
            f.cyclomatic_complexity = best_match.cyclomatic_complexity
        else:
            f.cyclomatic_complexity = 1  # Fallback if no matching lizard function found
            
        fn_halstead = fn_halstead_map.get(f.id, 0)
        f.maintainability_index = calculate_maintainability_index(
            fn_halstead,
            f.cyclomatic_complexity,
            f.lloc or 0
        )

    # Build hierarchy
    fn_map = {f.id: f for f in functions if f.id is not None}
    roots = []
    
    for f in functions:
        if f.parentId is not None and f.parentId in fn_map:
            parent = fn_map[f.parentId]
            parent.children.append(f)
        else:
            roots.append(f)
            
    # Optional: Sort roots and children by line?
    roots.sort(key=lambda x: x.start_line or 0)
    for f in functions:
        if f.children:
            f.children.sort(key=lambda x: x.start_line or 0)
            
    # Calculate Total CC (Cognitive Complexity + children's Total CC)
    def compute_total_cc(f):
        child_sum = 0
        for c in f.children:
            child_sum += compute_total_cc(c)
        
        # Determine base complexity: use cognitive_complexity field which holds our calculated CogC
        base_cc = f.cognitive_complexity or 0
        f.total_cognitive_complexity = base_cc + child_sum
        return f.total_cognitive_complexity

    for r in roots:
        compute_total_cc(r)
    
    # Calculate Maintainability Index from LLOC for consistency with exported metrics
    maintainability_index = calculate_maintainability_index(
        halstead_volume,
        file_cyclomatic_complexity,
        lloc
    )

    # Calculate Total Cognitive Complexity for the file
    total_cognitive_complexity = sum(f.total_cognitive_complexity for f in roots if f.total_cognitive_complexity is not None)

    file_metrics = FileMetrics(
        filename=filename,
        language="python",
        total_loc=loc,
        total_lloc=lloc,
        function_count=len(functions),
        total_complexity=file_cyclomatic_complexity,
        total_cognitive_complexity=total_cognitive_complexity,
        halstead_volume=halstead_volume,
        maintainability_index=maintainability_index,
        functions=roots
    )

    return file_metrics


def classify_ruff_rule(rule_code: str, message: str) -> tuple[str, str]:
    if rule_code == "invalid-syntax" or "syntax error" in message.lower():
        return "fatal", "fatal"
    if rule_code.startswith(("D", "ERA", "INP")):
        return "info", "info"
    if rule_code.startswith(("BLE", "PLE", "F", "E")):
        return "error", "error"
    if rule_code.startswith(("SIM", "PERF", "UP", "PLR")):
        return "warning", "refactor"
    if rule_code.startswith(("B", "W")):
        return "warning", "warning"
    return "warning", "warning"


def _process_ruff_diagnostics(diagnostics: List[Dict[str, Any]], filename: str, module_name: str) -> Dict[str, Any]:
    lint_errors = []
    counts = {"fatal": 0, "error": 0, "warning": 0, "refactor": 0}

    for diagnostic in diagnostics:
        location = diagnostic.get("location", {})
        end_location = diagnostic.get("end_location", {})
        rule_code = diagnostic.get("code") or ""
        message = diagnostic.get("message", "")
        severity, score_bucket = classify_ruff_rule(rule_code, message)

        if score_bucket in counts:
            counts[score_bucket] += 1
        else:
            counts["warning"] += 1

        lint_errors.append(
            LintError(
                type=severity,
                module=module_name,
                obj="",
                line=location.get("row", 0),
                column=location.get("column", 0),
                endLine=end_location.get("row"),
                endColumn=end_location.get("column"),
                path=filename,
                symbol=rule_code,
                message=message,
                message_id=rule_code,
            )
        )
    return {"errors": lint_errors, "counts": counts}


def _calculate_lint_score(counts: Dict[str, int], statement_count: int) -> float:
    if statement_count <= 0:
        return 10.0

    penalty = (
        10 * counts.get("fatal", 0)
        + 5 * counts.get("error", 0)
        + 2 * counts.get("warning", 0)
        + 1 * counts.get("refactor", 0)
        + 0.5 * counts.get("convention", 0)
    )
    density = penalty / statement_count
    score = 10.0 - (density * 10.0)
    return round(max(0.0, min(10.0, score)), 2)


def run_ruff(code: str, filename: str) -> Dict[str, Any]:
    lint_errors = []
    lint_score = None
    is_not_applicable = False

    if PurePath(filename).name == "__init__.py":
        return {
            "score": None,
            "errors": [],
            "is_not_applicable": True,
            "not_applicable_reason": "Package initializer files like __init__.py are skipped by the Python linter.",
        }

    try:
        ruff_args = [
            sys.executable,
            "-m",
            "ruff",
            "check",
            "--stdin-filename",
            filename,
            "--select",
            "ALL",
            "--output-format",
            "json",
            "--ignore",
            "I,T20,COM,ANN,D,ERA,INP,PLC",
            "-",
        ]

        process = subprocess.run(ruff_args, input=code, capture_output=True, text=True)

        if process.returncode not in (0, 1):
            raise RuntimeError(process.stderr.strip() or "ruff check failed")

        diagnostics = json.loads(process.stdout or "[]")
        module_name = PurePath(filename).stem
        try:
            parsed_tree = ast.parse(code, filename=filename)
            statement_count = max(1, sum(isinstance(node, ast.stmt) for node in ast.walk(parsed_tree)))
        except SyntaxError:
            statement_count = max(1, sum(1 for line in code.splitlines() if line.strip()))

        result = _process_ruff_diagnostics(diagnostics, filename, module_name)
        lint_errors = result["errors"]
        lint_score = _calculate_lint_score(result["counts"], statement_count)

    except Exception as e:
        print(f"Error running ruff on {filename}: {e}")

    return {
        "score": lint_score,
        "errors": lint_errors,
        "is_not_applicable": is_not_applicable,
        "not_applicable_reason": None,
    }
