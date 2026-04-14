User Functional Requirement
- The system shall allow users to securely log in and connect GitHub repositories for analysis.
- The system shall allow users to analyze a selected repository and view key software metrics such as Lines of Code (LOC), Cyclomatic Complexity, Lines per Function, and Maintainability metrics.
- The system shall allow users to visualize repository structure and analysis results through an interactive 3D or graph-based interface.
- The system shall allow users to view software components such as files, functions, and classes as visual elements, with metrics represented through visual properties such as size, color, and shape.
- The system shall allow users to quickly navigate the codebase by searching for files and viewing a structured list of functions.
- The system shall allow users to explore different versions of a repository by switching branches, viewing commit history, and inspecting contributor information.
- The system shall allow users to observe how the project evolves over time through timeline playback, including controls for playback speed and starting point selection.
- The system shall allow users to identify software quality issues by viewing code quality warnings, maintainability metrics, and linter suggestions.
- The system shall allow users to inspect source code in multiple display modes, such as plain text, syntax-highlighted view, and linter suggestion view.
- The system shall allow users to interact with CodeWorld through a visually engaging circular freeform honeycomb-style interface.
- The system shall allow users to personalize their experience using controls such as theme switching, home navigation, and audio toggle.

System Functional Requirement
- The system shall authenticate users through GitHub OAuth to ensure secure access and data privacy.
- The system shall retrieve repository information, including repository metadata, commit history, branch details, and contributor-related data, through the GitHub REST API.
- The system shall parse JavaScript, TypeScript, JSX, and TSX source files using Babel to generate Abstract Syntax Trees (ASTs) for analysis.
- The system shall compute and store software analysis data, including LOC, LLOC, Cyclomatic Complexity, Number of Functions (NOF), Cognitive Complexity, Maintainability Index, commit information, and user-related data.
- The system shall generate data models for software structure and metric relationships, and render them through graph-based or hierarchical visualizations.
- The system shall support repository evolution analysis by displaying metric changes across commits and branches, and provide timeline playback controls including play, pause, previous, next, speed adjustment, and starting commit selection.
- The system shall provide repository exploration features, including file and function search, branch selection, commit history viewing (with commit message, author, timestamp, and load-more support), and contributor information display.
- The system shall automatically detect code quality issues, including design flaws, complexity-related problems, and maintainability concerns, based on predefined threshold conditions.
- The system shall provide code quality inspection features, including lint warning and error display, severity categorization, file navigation from lint results, and maintainability score visualization.
- The system shall provide a function table for function-level analysis, displaying structured metrics and supporting sorting by function name, cognitive complexity, cyclomatic complexity, total complexity, maintainability index, nesting depth, Halstead volume, lines of code, and line number.
- The system shall provide filtering options for repository analysis results, including complexity-based and directory-based filtering.
- The system shall provide a source code viewer supporting raw/plain text, syntax-highlighted, and linter suggestion display modes.
- The system shall ensure communication between backend computation services and frontend visualization components through RESTful APIs.
