import ast
import token
import tokenize
from io import BytesIO
from typing import List, Dict, Any, Optional
from app.model.analyzer_model import FileMetrics, FunctionMetric

GLOBAL_FUNC_NAME = "code outside functions"

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
            # Check if this is an 'elif' (else if)
            # In Python AST, 'elif' appears as a nested If in 'orelse'
            # But we must distinguish between real nested if in else block vs elif
            # Actually, `elif` is just `orelse=[If(...)]`.
            # We can't easily distinguish source-level `elif` from `else: if ...` without line numbers or assumptions.
            # However, standard Cognitive Complexity treats `else if` as +1 (structural).
            # Wait, JS version says: `else if` -> complexity += 1 + (nesting-1)
            
            # Let's start with basic structural
            nonlocal nesting
            
            # If this node is the single child of a parent's `orelse`, it might be an `elif`
            # For simplicity in this port, we will treat it as standard structural for now,
            # but we can try to detect the pattern.
            
            add_structural()
            nesting += 1
            check_nesting()
            
            self.generic_visit(node)
            
            nesting -= 1
            
            # Handle 'else' (fundamental)
            # In Python, 'else' is in `orelse`. If `orelse` is not empty and NOT an `elif`...
            if node.orelse:
                # if orelse is a single If node, it's likely an elif -> handled by visit_If recursively
                # if orelse has multiple statements or non-If, it's a real `else`
                 if not (len(node.orelse) == 1 and isinstance(node.orelse[0], ast.If)):
                     add_fundamental()


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
            if function_name and isinstance(node.func, ast.Name) and node.func.id == function_name:
                add_fundamental()
            self.generic_visit(node)

    ComplexityVisitor().visit(func_node)
    
    return {"complexity": complexity, "max_nesting": max_nesting}


def calculate_metrics(code: str, filename: str) -> FileMetrics:
    try:
        tree = ast.parse(code)
    except SyntaxError:
        # Fallback for invalid syntax, or return empty metrics
        return FileMetrics(
             filename=filename,
             language="python",
             total_loc=len(code.splitlines()),
             total_nloc=0,
             function_count=0,
             total_complexity=0,
             complexity_max=0,
             maintainability_index=0.0,
             functions=[]
        )

    # Count NLOC (Non-Comment Lines of Code)
    # Using tokenize to skip comments and empty lines
    import math
    N_total = 0
    unique_tokens = set()

    nloc = 0
    try:
        tokens = list(tokenize.tokenize(BytesIO(code.encode('utf-8')).readline))
        lines_with_code = set()
        for tok in tokens:
            if tok.type not in (tokenize.COMMENT, tokenize.NL, tokenize.NEWLINE, tokenize.ENDMARKER, tokenize.INDENT, tokenize.DEDENT, tokenize.ENCODING):
                lines_with_code.add(tok.start[0])
                if tok.string.strip():
                    N_total += 1
                    unique_tokens.add(tok.string)
        nloc = len(lines_with_code)
    except tokenize.TokenError:
        nloc = len([l for l in code.splitlines() if l.strip() and not l.strip().startswith('#')])

    n_unique = len(unique_tokens)
    halstead_volume = N_total * math.log2(n_unique) if n_unique > 0 else 0

    try:
        import lizard
        lizard_info = lizard.analyze_file.analyze_source_code(filename, code)
        lizard_funcs = lizard_info.function_list
        lizard_global_cc = lizard_info.average_cyclomatic_complexity
    except Exception:
        lizard_funcs = []
        lizard_global_cc = 1

    functions = []

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
    
    # Global NLOC will be calculated later or we can estimate it.
    # Let's set it to 0 initially and correct it like in JS.
    
    global_metric = FunctionMetric(
        name=GLOBAL_FUNC_NAME,
        long_name=GLOBAL_FUNC_NAME,
        cognitive_complexity=global_res["complexity"],
        cyclomatic_complexity=int(lizard_global_cc) if lizard_global_cc else 1,
        nloc=0, # To be updated
        token_count=0,
        maintainability_index=100.0,
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
            
            # NLOC calculation
            func_nloc = len([l for l in lines_with_code if start_line <= l <= end_line])

            functions.append(FunctionMetric(
                name=name,
                long_name=name,
                cognitive_complexity=res["complexity"],
                cyclomatic_complexity=0, # Will be set via lizard
                nloc=func_nloc,
                token_count=0,
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
    
    # Finalize Global NLOC
    # Global NLOC = Total NLOC - Sum(Top-Level Functions NLOC)
    # Top-level functions are those with parentId is None
    top_level_nloc = sum(f.nloc for f in functions if f.parentId is None and f.id != -1)
    global_metric.nloc = max(0, nloc - top_level_nloc)
    
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
            
        # Calculate MI for function
        fn_loc = (f.end_line - (f.start_line or 1) + 1) if f.end_line else 1
        mi = 100.0
        if fn_loc > 0:
            fn_halstead = fn_halstead_map.get(f.id, 0)
            log_v = math.log(fn_halstead) if fn_halstead > 0 else 0
            log_loc = math.log(fn_loc)
            orig_mi = 171 - 5.2 * log_v - 0.23 * f.cyclomatic_complexity - 16.2 * log_loc
            mi = max(0.0, min(100.0, orig_mi * 100.0 / 171.0))
        f.maintainability_index = round(mi, 2)

    # Stats
    complexity_sum = sum(f.cyclomatic_complexity for f in functions if f.cyclomatic_complexity is not None)
    complexity_max = max((f.cyclomatic_complexity for f in functions if f.cyclomatic_complexity is not None), default=0)
    complexity_avg = round(complexity_sum / len(functions), 2) if functions else 0.0
    
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
    
    # Calculate Maintainability Index
    loc = len(code.splitlines())
    maintainability_index = 100.0
    if loc > 0:
        log_v = math.log(halstead_volume) if halstead_volume > 0 else 0
        log_loc = math.log(loc)
        original_mi = 171 - 5.2 * log_v - 0.23 * complexity_sum - 16.2 * log_loc
        mi_normalized = max(0.0, min(100.0, original_mi * 100.0 / 171.0))
        maintainability_index = round(mi_normalized, 2)

    return FileMetrics(
        filename=filename,
        language="python",
        total_loc=loc,
        total_nloc=nloc,
        function_count=len(functions),
        total_complexity=complexity_sum,
        complexity_max=complexity_max,
        maintainability_index=maintainability_index,
        functions=roots
    )
