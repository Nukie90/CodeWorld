from fastapi.responses import JSONResponse
import lizard
import tempfile
import os
import zipfile
import io
from typing import List, Set, Optional

# --- AST-first (JSX-aware) dependencies ---
try:
    import esprima  # Python port; JSX support can vary by version
    _HAS_ESPRIMA = True
except Exception:
    _HAS_ESPRIMA = False

import re

from app.model.analyzer_model import FileMetrics, FunctionMetric, FolderMetrics, FolderAnalysisResult


# -------------------------------
# AST helpers: Esprima (prefer) → Regex (fallback)
# -------------------------------
def _extract_functions_ast(code: str) -> Set[str]:
    """
    Extract function/method names from JSX/JS using AST if possible,
    otherwise fall back to regex. Returns a SET of identifiers.
    """
    # --- Esprima path ---
    if _HAS_ESPRIMA:
        try:
            # Some esprima builds accept 'jsx' in options; others just ignore it.
            # We try parseModule with tolerant=True and hope JSX is accepted.
            # If it fails, we'll fall through to regex.
            tree = esprima.parseModule(code, tolerant=True, loc=True)  # type: ignore
            names: Set[str] = set()

            def walk(node):
                if isinstance(node, dict):
                    t = node.get("type")
                    if t == "FunctionDeclaration":
                        ident = node.get("id")
                        if ident and isinstance(ident, dict) and ident.get("name"):
                            names.add(ident["name"])
                    elif t == "VariableDeclarator":
                        # const Foo = (...) => {}  OR const Foo = function(...) {}
                        init = node.get("init")
                        ident = node.get("id")
                        if ident and isinstance(ident, dict) and ident.get("name") and isinstance(init, dict):
                            if init.get("type") in ("ArrowFunctionExpression", "FunctionExpression"):
                                names.add(ident["name"])
                    elif t == "MethodDefinition":
                        # class Foo { render() {} }
                        key = node.get("key")
                        if isinstance(key, dict) and key.get("name"):
                            names.add(key["name"])
                    # Recurse
                    for v in node.values():
                        walk(v)
                elif isinstance(node, list):
                    for item in node:
                        walk(item)

            walk(tree)
            return {n for n in names if isinstance(n, str) and n.isidentifier()}
        except Exception:
            # AST failed (likely JSX not supported in this esprima build) → regex fallback
            pass

    # --- Regex fallback (covers common patterns) ---
    # function Foo(...) { ... }
    func_decl = re.findall(r'\bfunction\s+([A-Za-z_]\w*)\s*\(', code)

    # export default function Foo(...) { ... }
    export_func_decl = re.findall(r'\bexport\s+default\s+function\s+([A-Za-z_]\w*)\s*\(', code)

    # const Foo = (...) => { ... }  OR let Foo = function(...) { ... }
    arrow_or_func_expr = re.findall(
        r'\b(?:const|let|var)\s+([A-Za-z_]\w*)\s*=\s*(?:\([^)]*\)|[A-Za-z_]\w*)\s*=>'
        r'|\b(?:const|let|var)\s+([A-Za-z_]\w*)\s*=\s*function\s*\(',
        code
    )
    names_from_assign = []
    for left, right in arrow_or_func_expr:
        if left:
            names_from_assign.append(left)
        elif right:
            names_from_assign.append(right)

    # class methods: class X { render() { } handleClick() { } }
    class_methods = re.findall(
        r'\bclass\s+[A-Za-z_]\w*\s*{[^}]*?([A-Za-z_]\w*)\s*\([^)]*\)\s*{',
        code,
        flags=re.S
    )

    candidates = set(func_decl + export_func_decl + names_from_assign + class_methods)
    return {n for n in candidates if n.isidentifier()}


def _filter_lizard_functions_with_names(result, allowed_names: Optional[Set[str]]) -> List[FunctionMetric]:
    """
    Turn lizard function_list into FunctionMetric list.
    - If allowed_names is provided: keep only those names (AST-vetted).
    - If None: keep only identifier-like names (filter out '&&', '?', '(anonymous)').
    """
    funcs: List[FunctionMetric] = []
    for f in result.function_list:
        name = (f.name or "").strip()
        if allowed_names is not None:
            if name not in allowed_names:
                continue
        else:
            if not name.isidentifier():
                continue

        funcs.append(FunctionMetric(
            name=name,
            start_line=int(getattr(f, "start_line", 0)),
            nloc=int(getattr(f, "nloc", 0)),
            cyclomatic_complexity=int(getattr(f, "cyclomatic_complexity", 0)),
        ))
    return funcs


# -------------------------------
# Public API (AST → Lizard by default)
# -------------------------------
def analyze_js(code: str, filename: str, engine: str = "auto") -> FileMetrics:
    """
    Analyze a single JS/JSX source text.

    engine:
      - "auto" (default): Parse AST first (Esprima/regex) → run Lizard → keep only Lizard funcs whose names exist in AST set.
      - "ast"           : Same as "auto" but will still run Lizard for metrics; primarily here for explicitness.
      - "lizard"        : Lizard-only (keep identifier-like names).

    Returns FileMetrics with LOC/NLOC/CC from Lizard, and function list filtered by AST when applicable.
    """
    # Always run Lizard (we need CC/LOC/line positions)
    lizard_result = lizard.analyze_file.analyze_source_code(filename, code)

    if engine in ("auto", "ast"):
        allowed = _extract_functions_ast(code)  # set() if none found is still valid
        print (f"AST-extracted function names for {filename}: {allowed}")
        # If AST yielded nothing but we *do* have functions in Lizard, we can fall back to identifier filter
        if not allowed:
            funcs = _filter_lizard_functions_with_names(lizard_result, allowed_names=None)
        else:
            funcs = _filter_lizard_functions_with_names(lizard_result, allowed_names=allowed)
    else:
        # Pure Lizard path (identifier-only filter)
        funcs = _filter_lizard_functions_with_names(lizard_result, allowed_names=None)

    # Aggregate metrics
    cc_sum = sum(int(f.cyclomatic_complexity) for f in funcs)
    function_count = len(funcs)
    complexity_avg = round(cc_sum / function_count, 2) if function_count else 0.0
    complexity_max = max((int(f.cyclomatic_complexity) for f in funcs), default=0)

    return FileMetrics(
        filename=filename,
        language=getattr(lizard_result, "language", None),
        total_loc=int(getattr(lizard_result, "nloc", 0) + getattr(lizard_result, "comment_lines", 0)),
        total_nloc=int(getattr(lizard_result, "nloc", 0)),
        function_count=function_count,
        complexity_avg=complexity_avg,
        complexity_max=complexity_max,
        functions=funcs
    )


def analyze_folder(zip_content: bytes, folder_name: str, engine: str = "auto") -> FolderAnalysisResult:
    """
    Analyze a folder uploaded as a zip file.
    engine: "auto" (AST→Lizard), "ast", or "lizard" (passed to analyze_js).
    """
    with tempfile.TemporaryDirectory() as temp_dir:
        with zipfile.ZipFile(io.BytesIO(zip_content), 'r') as zip_ref:
            zip_ref.extractall(temp_dir)

        js_files = []
        for root, dirs, files in os.walk(temp_dir):
            for file in files:
                if file.lower().endswith(('.js', '.jsx')):
                    file_path = os.path.join(root, file)
                    relative_path = os.path.relpath(file_path, temp_dir)
                    js_files.append((file_path, relative_path))

        file_metrics_list: List[FileMetrics] = []
        total_loc = 0
        total_nloc = 0
        total_functions = 0
        complexity_sum = 0.0
        complexity_max = 0

        for file_path, relative_path in js_files:
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()

                file_metrics = analyze_js(content, relative_path, engine=engine)
                file_metrics_list.append(file_metrics)

                total_loc += file_metrics.total_loc
                total_nloc += file_metrics.total_nloc
                total_functions += file_metrics.function_count
                complexity_sum += file_metrics.complexity_avg * max(file_metrics.function_count, 1)
                if file_metrics.complexity_max > complexity_max:
                    complexity_max = file_metrics.complexity_max

            except Exception:
                continue

        folder_complexity_avg = round(complexity_sum / total_functions, 2) if total_functions > 0 else 0.0

        folder_metrics = FolderMetrics(
            folder_name=folder_name,
            total_files=len(file_metrics_list),
            total_loc=total_loc,
            total_nloc=total_nloc,
            total_functions=total_functions,
            complexity_avg=folder_complexity_avg,
            complexity_max=complexity_max,
            files=file_metrics_list
        )

        return FolderAnalysisResult(
            folder_metrics=folder_metrics,
            individual_files=file_metrics_list
        )