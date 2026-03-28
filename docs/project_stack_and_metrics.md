# CodeWorld Stack And Metrics

## Overview

CodeWorld is a repository analysis application with:

- a React/Vite frontend
- a FastAPI backend
- a separate Node.js analyzer service for JavaScript and TypeScript
- a Python analyzer for Python files
- adapter-based dispatch so each file type is analyzed by the correct engine

The project supports:

- repository cloning and caching
- branch and commit analysis
- incremental commit-based re-analysis
- file and folder metric aggregation
- JS/TS linting through ESLint
- Python linting through Ruff
- AI chat over project context through OpenRouter

## Runtime Architecture

### Frontend

Main frontend stack:

- React 19
- Vite
- React Router
- Axios
- Tailwind CSS via `@tailwindcss/vite`
- Recharts
- Three.js
- D3
- GSAP
- Lucide React

Key frontend files:

- `frontend/src/main.jsx`
- `frontend/src/routes/index.jsx`
- `frontend/src/services/api.js`
- `frontend/src/pages/ResultsPage.jsx`
- `frontend/src/components/features/visualizations/Island3DVisualization.jsx`

Frontend responsibilities:

- GitHub repo input and OAuth callback handling
- results view and visualizations
- commit graph display
- file/function drill-down
- floating AI assistant UI

### Python Backend

Main backend stack:

- FastAPI
- Pydantic
- Uvicorn
- HTTPX
- python-dotenv

Supporting analysis and utility libraries:

- pygount
- lizard
- radon
- ruff
- tree-sitter

Key backend files:

- `backend/app/main.py`
- `backend/app/api/routes/auth_routes.py`
- `backend/app/api/routes/repo_routes.py`
- `backend/app/api/routes/analyze_routes.py`
- `backend/app/api/routes/lint_routes.py`
- `backend/app/api/routes/ai_routes.py`
- `backend/app/services/repo_manager.py`
- `backend/app/services/analyze_local_folder.py`

Backend responsibilities:

- GitHub OAuth
- repository cloning and checkout
- repository caching
- progress streaming during analysis
- adapter dispatch for file analyzers
- folder/file metric aggregation
- AI chat endpoint

### JS / TS Analyzer Service

The JS analyzer is a separate Express service running on port `3001`.

Main stack:

- Node.js
- Express
- Babel parser
- Babel traverse
- ESLint
- eslint-plugin-react
- eslint-plugin-react-hooks
- `@typescript-eslint/parser`
- `@typescript-eslint/eslint-plugin`
- multer
- adm-zip

Key files:

- `backend/app/js_plugin/server.js`
- `backend/app/js_plugin/eslint.config.js`
- `backend/app/utils/get_file_matrix_js.py`

Responsibilities:

- analyze `.js`, `.jsx`, `.ts`, `.tsx`
- compute JS/TS metrics
- lint JS/TS code
- batch analysis over streamed multipart requests
- zip upload analysis

## Adapter Model

CodeWorld uses adapters to decide which engine analyzes each file.

Current adapters:

- `JSPluginAdapter` for `.js`, `.jsx`, `.ts`, `.tsx`
- `PythonPluginAdapter` for `.py`, `.pyw`

Fallback behavior:

- unsupported files are analyzed with `pygount`
- unsupported files only get coarse metrics like LOC/LLOC/language, not language-specific complexity metrics

Key files:

- `backend/app/adapter/adapter.py`
- `backend/app/adapter/factory.py`
- `backend/app/adapter/js_plugin_adapter.py`
- `backend/app/adapter/python_plugin_adapter.py`
- `backend/app/services/analyze_local_folder.py`

## Repository Analysis Flow

High-level flow:

1. clone repo or reuse cached repo
2. scan files or reuse prior analysis for unchanged files
3. group files by adapter
4. batch-analyze supported files
5. analyze unsupported files via `pygount`
6. aggregate file metrics into folder metrics

Incremental commit analysis:

- commit history uses cached previous analysis when possible
- changed files are identified with `git diff-tree`
- changed file contents can be read directly from git objects using `git cat-file --batch`
- this avoids full working tree checkout for every historical commit

Key files:

- `backend/app/services/repo_manager.py`
- `backend/app/api/routes/repo_routes.py`
- `backend/app/services/analyze_local_folder.py`
- `backend/app/utils/analysis_helpers.py`

## Data Model

Main response models:

- `LintError`
- `FileLint`
- `FunctionMetric`
- `FileMetrics`
- `FolderMetrics`
- `FolderAnalysisResult`

Important semantics:

- a virtual function named `code outside functions` is included for both Python and JS analysis
- `function_count` includes that virtual top-level scope entry
- hierarchical function nesting is preserved through `id`, `parentId`, and `children`

Key file:

- `backend/app/model/analyzer_model.py`

## Core Metrics

### File-Level Metrics

Per file, CodeWorld returns:

- `total_loc`
- `total_lloc`
- `function_count`
- `total_complexity`
- `total_cognitive_complexity`
- `halstead_volume`
- `maintainability_index`
- `functions`

### Function-Level Metrics

Per function, CodeWorld returns:

- `name`
- `long_name`
- `start_line`
- `end_line`
- `lloc`
- `cognitive_complexity`
- `cyclomatic_complexity`
- `total_cognitive_complexity`
- `maintainability_index`
- `max_nesting_depth`
- `halstead_volume`
- `children`

### Folder-Level Metrics

Folder rollups are built by:

- summing `LOC`
- summing `LLOC`
- summing function counts
- summing total complexity
- summing file halstead volumes
- averaging file maintainability indices across files that have MI

Implementation:

- `backend/app/utils/analysis_helpers.py`

## Shared Formulas

### Halstead Volume

Both analyzers use this structure:

```text
Halstead Volume = N_total * log2(n_unique)
```

Where:

- `N_total` = count of valid non-comment tokens
- `n_unique` = count of unique valid tokens

### Maintainability Index

Both analyzers use the same base formula:

```text
original_MI = 171 - 5.2 * ln(V) - 0.23 * CYC - 16.2 * ln(LOC_or_LLOC)
MI = clamp(0, 100, original_MI * 100 / 171)
```

Where:

- `V` = Halstead Volume
- `CYC` = cyclomatic complexity
- `LOC_or_LLOC` = file logical lines or lines, depending on analyzer logic

### Total Cognitive Complexity

For both analyzers, a parent function accumulates child cognitive complexity:

```text
total_cognitive_complexity(function) =
    cognitive_complexity(function) +
    sum(total_cognitive_complexity(children))
```

File total cognitive complexity is the sum of root function totals.

## Python Analyzer Knowledge

Key file:

- `backend/app/python_plugin/python_analyzer.py`

### Python LOC / LLOC

Python file LOC:

- starts from `len(code.splitlines())`
- may be replaced by `radon.raw.analyze(code).loc` when Radon succeeds

Python file LLOC:

- is first computed by a custom token-based `count_lloc`
- then replaced by `radon.raw.analyze(code).lloc` when Radon succeeds

The custom `count_lloc` logic:

- walks Python tokens
- splits logical statements at semicolons
- ignores comments and whitespace tokens
- gives special treatment to statements ending in `:`
- can exclude nested function/class ranges when calculating local scope LLOC

### Python Cyclomatic Complexity

Python file cyclomatic complexity starts at `1` and increments for:

- `if`
- ternary `if` expressions
- `for`
- `async for`
- `while`
- `except`
- boolean operations

There are two variants:

- full file cyclomatic complexity
- top-level-only cyclomatic complexity using `skip_nested_functions=True`

Per-function cyclomatic complexity:

- is sourced from `lizard`
- lizard functions are matched back to AST functions by name and nearest start line
- if no match exists, the fallback cyclomatic complexity is `1`

### Python Cognitive Complexity

Python cognitive complexity is AST-based.

Structural increments happen for:

- `if`
- loops
- `try/except`
- ternary expressions

Fundamental increments happen for:

- `else`
- boolean operator sequences
- recursion

Special behavior:

- nested functions are not traversed when computing a function's own cognitive complexity
- decorator-shaped wrappers get a nesting exception
- `max_nesting_depth` is tracked relative to the function base nesting

### Python Halstead Volume

Python Halstead volume is based on tokenization:

- comments and non-semantic tokens are ignored
- token strings are used for uniqueness

### Python Maintainability Index

Python MI uses:

- file Halstead volume
- file cyclomatic complexity
- file LLOC

Function MI uses:

- function Halstead volume
- lizard cyclomatic complexity for that function
- function LLOC

### Python Linting

Python linting is performed by Ruff.

Command shape:

```text
python -m ruff check --stdin-filename <filename> --select ALL --output-format json --ignore I,T20,COM,ANN,D,ERA,INP,PLC -
```

Special case:

- `__init__.py` is marked not applicable and skipped

Ruff severity mapping:

- `fatal`: invalid syntax
- `error`: codes starting with `BLE`, `PLE`, `F`, `E`
- `refactor`: codes starting with `SIM`, `PERF`, `UP`
- `warning`: codes starting with `B`, `W`
- `info`: codes starting with `D`, `ERA`, `INP`

Python lint score formula:

```text
penalty =
    10 * fatal +
    5 * error +
    2 * warning +
    1 * refactor +
    0.5 * convention

density = penalty / statement_count
score = clamp(0, 10, 10 - density * 10)
```

Statement count is estimated from AST statements, with a line-based fallback on syntax errors.

## JS / TS Analyzer Knowledge

Key file:

- `backend/app/js_plugin/server.js`

### Parser And Supported Syntax

The JS analyzer parses code with Babel using:

- `jsx`
- `typescript`
- `classProperties`
- `classPrivateProperties`
- `objectRestSpread`

Supported file extensions:

- `.js`
- `.jsx`
- `.ts`
- `.tsx`

### JS / TS LOC / LLOC

JS file LOC:

- is currently based on newline counting

JS file LLOC:

- is derived from comment-masked source
- counts non-empty logical lines
- can exclude nested function bodies when computing per-function local scope

Important behavior:

- comments are masked before line counting
- nested function ranges can be blanked out when computing local metrics

### JS / TS Cyclomatic Complexity

File cyclomatic complexity starts at `1` and increments for:

- `IfStatement`
- `ConditionalExpression`
- `ForStatement`
- `ForInStatement`
- `ForOfStatement`
- `WhileStatement`
- `DoWhileStatement`
- `CatchClause`
- logical `&&`
- logical `||`
- `SwitchCase` entries with a test

There are two variants:

- full-file cyclomatic complexity
- global-scope-only cyclomatic complexity that skips nested functions

Per-function cyclomatic complexity:

- starts at `1`
- traverses the function body
- skips nested child functions
- increments on the same control-flow constructs as file complexity

### JS / TS Cognitive Complexity

JS cognitive complexity is Babel-traversal-based.

Structural increments happen for:

- `if`
- loops
- `catch`
- ternary expressions

Fundamental increments happen for:

- `else`
- `switch case`
- logical operator sequences `&&`, `||`, `??`
- recursion
- labeled `break` and `continue`

Special behavior:

- `else if` is treated specially to avoid double-counting structural nesting
- nested child functions are skipped
- `max_nesting_depth` is tracked relative to the function base nesting

### JS / TS Function Naming

If a function is anonymous, the analyzer tries to infer a name from:

- function identifier
- variable declarator name
- object property key
- class method key
- object method key

### JS / TS Halstead Volume

JS Halstead volume uses Babel tokens:

- comment and EOF tokens are ignored
- token text slices are counted
- uniqueness is derived from the source substring of each token

### JS / TS Maintainability Index

JS file MI uses:

- file Halstead volume
- file cyclomatic complexity
- file LLOC

Function MI uses:

- function Halstead volume
- function cyclomatic complexity
- function LLOC

### JS / TS Linting

JS linting is performed by ESLint.

Config stack includes:

- `@eslint/js`
- `eslint-plugin-react`
- `eslint-plugin-react-hooks`
- `@typescript-eslint/parser`
- `@typescript-eslint/eslint-plugin`

General rule behavior:

- browser/module defaults for frontend-style files
- Node/CommonJS override for config files and `server.js`

Analyzer-specific CommonJS fallback:

- uploaded code is first linted normally
- if code looks like CommonJS and ESLint reports `no-undef` for `require`, `module`, `exports`, `__dirname`, or `__filename`
- the analyzer retries linting with a CommonJS + Node globals override

This reduces false positives when analyzing external repositories that use CommonJS.

JS lint score formula:

```text
penalty =
    10 * fatal +
    5 * error +
    2 * warning +
    1 * refactor +
    0.5 * convention

density = penalty / statement_count
score = clamp(0, 10, 10 - density * 10)
```

Statement count is estimated by traversing the parsed AST and counting statement nodes, with a non-empty-line fallback if parsing fails.

## Unsupported File Handling

Files that do not match JS/TS or Python adapters fall back to `pygount`.

Fallback output provides:

- filename
- language
- total LOC
- total LLOC
- zero function count
- zero complexity
- `is_unsupported = true`

If `pygount` also fails:

- the project falls back to raw line counts
- language is marked as `unsupported`

## AI Layer

Key files:

- `backend/app/services/ai_service.py`
- `backend/app/api/routes/ai_routes.py`
- `frontend/src/components/features/chat/ChatBot.jsx`

Current AI stack:

- OpenRouter API
- model: `nvidia/nemotron-3-nano-30b-a3b:free`

Behavior:

- frontend sends chat messages and optional project context
- backend injects a system prompt summarizing repository context
- response is cleaned to strip reasoning/final-answer boilerplate if the model includes it

## Operational Notes

- The Python backend runs on port `8000`
- The JS analyzer service runs on port `3001`
- The frontend calls the Python backend at `http://127.0.0.1:8000/api`
- JS file analysis is proxied through the Python backend into the Node analyzer service
- repo analysis can be cached by commit hash to speed repeated timeline traversal

## Known Project-Specific Semantics

- `function_count` includes the virtual global scope function
- folder maintainability index is an average of file MI values, not a weighted average
- unsupported files still contribute LOC/LLOC totals at folder level
- Python per-function cyclomatic complexity comes from `lizard`, not from the local AST visitor
- Python file LLOC and LOC prefer Radon output when available
- JS analyzed repositories may contain CommonJS, and the analyzer now explicitly handles that linting case
