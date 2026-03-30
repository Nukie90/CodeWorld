# Software Testing Project Report: CodeWorld

## 1. Project and Requirements Overview

### Project Purpose
**CodeWorld** is a modern, web-based platform designed to visualize and analyze software repositories. Core features include:
- **3D Visualization**: Transforming code structures into interactive 3D "islands" and "towers."
- **Complexity Analysis**: Calculating Cognitive and Cyclomatic complexity to identify maintenance hotspots.
- **Metric Tracking**: Providing deep insights into Lines of Code (LOC), function nesting, and Halstead volume.
- **Timeline Progression**: Visualizing the evolution of a codebase over time.
- **Linting Integration**: Surface potential bugs and style issues via integrated linter support (Ruff/ESLint).

### Software Requirements
The testing activities were based on the following key requirements:
1. **GitHub OAuth Integration**: Securely authenticate users and access their repositories.
2. **Repository Analysis**: Correctly parse Python and JavaScript codebases to extract metrics.
3. **Interactive Visualization**: Respond to user inputs (clicks, filters) to update the 3D and 2D charts.
4. **Resilience**: Gracefully handle large repositories, missing files, and API failures.
5. **Multi-branch Support**: Allow users to switch branches and compare analysis results.

---

## 2. Test Plan

### Overall Strategy
Our team adopted a multi-layered testing strategy to ensure reliability from the function level to the user interface.

| Stage | Focus | Who | When |
| :--- | :--- | :--- | :--- |
| **Unit Testing** | Individual utility functions and model logic. | Developers | During development (TDD/Incremental). |
| **Integration Testing** | API endpoints and communication between backend services. | Developers | During PR reviews. |
| **System Testing** | Full-stack flows (Login -> Analysis -> Visualization). | QA / Developers | Pre-release. |
| **Acceptance Testing** | Validation against user stories and design requirements. | Team Lead | Final verification. |

### Test Stages
- **Unit Testing**: Focused on metric calculation logic in `backend/app/utils` and frontend component rendering using **Jest** and **React Testing Library**.
- **Integration Testing**: Verified FastAPI route reliability and database/cache interactions using **Pytest-asyncio** and **HTTPX**.
- **System Testing**: Conducted using **Playwright**, simulating real user browsers to interact with the full application stack.
- **Acceptance Testing**: Automated E2E scripts were used to validate "Happy Path" scenarios (e.g., successful repo analysis).

---

## 3. Test Design and Coverage

### Design Techniques
1. **Boundary Value Analysis**: Applied to code complexity calculations (e.g., testing functions with 0 complexity vs. very high nesting).
2. **Equivalence Partitioning**: Used for input validation (e.g., valid vs. invalid GitHub URLs).
3. **Mocking/Stubbing**: Extensive use of mocks for GitHub API calls and external CLI tools (Ruff) to ensure test isolation.

### 3.2 Traceability Matrix
The following matrix maps software requirements to verified test cases, ensuring 95% of critical system features are validated:

| Requirement ID | Requirement Summary | Related Test Case IDs | Test Coverage Status |
| :--- | :--- | :--- | :--- |
| UF-01 | Secure user login and GitHub repository connection | TC-001, TC-005 | Full |
| UF-02 | Repository analysis and display of key software metrics | TC-008, TC-009 | Full |
| UF-03 | Interactive visualization of repository structure and analysis results | TC-017 | Full |
| UF-04 | Visual representation of files, functions, and classes using metric-based properties | TC-018 | Partial |
| UF-05 | File search and structured function-list navigation | TC-019, TC-020, TC-021 | Full |
| UF-06 | Version exploration through branches, commit history, and contributors | TC-022, TC-023, TC-024, TC-025 | Full |
| UF-07 | Timeline playback of repository evolution with controls | TC-026, TC-027 | Full |
| UF-08 | Identification of software quality issues via warnings, maintainability, and lint suggestions | TC-028, TC-029, TC-030, TC-031 | Full |
| UF-09 | Source code inspection in multiple display modes | TC-032, TC-033 | Full |
| UF-10 | Interaction through a circular freeform honeycomb-style interface | TC-041 | Partial |
| UF-11 | Personalization through theme, home navigation, and audio toggle | TC-042 | Full |
| SF-01 | GitHub OAuth authentication and secure access control | TC-002, TC-003, TC-004 | Full |
| SF-02 | Retrieval of repository metadata, branches, commits, and contributor data via GitHub REST API | TC-006, TC-007, TC-024, TC-025 | Full |
| SF-03 | Babel parsing of JS, TS, JSX, and TSX into ASTs | TC-010, TC-011, TC-012 | Full |
| SF-04 | Computation and storage of software metrics, commit data, and user-related analysis data | TC-013, TC-014, TC-015 | Full |
| SF-05 | Generation of software structure/metric data models and rendering in visualizations | TC-016, TC-017 | Full |
| SF-06 | Repository evolution analysis with playback, speed, and commit navigation controls | TC-026, TC-027 | Full |
| SF-07 | Repository exploration features including search, branch selection, commit history, and contributor display | TC-021, TC-022, TC-024, TC-025 | Full |
| SF-10 | Function table with structured metrics and sortable columns | TC-034, TC-035 | Full |
| SF-11 | Filtering of analysis results by complexity and directory | TC-036, TC-037 | Full |
| SF-12 | Source code viewer supporting plain, syntax-highlighted, and linter suggestion modes | TC-032, TC-033 | Full |
| SF-13 | RESTful communication between backend computation services and frontend visualization components | TC-038, TC-039, TC-040 | Full |

### Code Coverage Metrics
**Backend (FastAPI):**
- **Statement Coverage**: 33.5% (High coverage in API routes, lower in legacy adapter logic).
- **Branch Coverage**: Being tracked via `coverage.py`.
- **Top Metrics**: `analyze_routes.py` (76%), `main.py` (79%).

**Frontend (React):**
- **Component Coverage**: 100% of core visualization components (Bar charts, Sidebars, Viewers) are covered by unit tests.

---

## 4. Test Implementation and Execution

### Tooling
- **Backend Tests**: Pytest, Coverage.py, HTTPX, Pytest-Mock.
- **Frontend Tests**: Jest, React Testing Library, Vitest.
- **System/E2E Tests**: Playwright (Node.js).
- **Test Management & Exploration**: **Postman** (used for manual REST API validation and contract exploration).

### Implementation Examples

#### Backend Integration Test (Pytest)
```python
@pytest.mark.asyncio
async def test_analyze_repo_success(async_client, mock_repo_manager):
    response = await async_client.post("/api/analyze/repo", json={"url": "test_url"})
    assert response.status_code == 200
    assert response.json()["repo_url"] == "test_url"
```

#### Frontend Unit Test (Jest)
```javascript
test('renders theme toggle and switches mode', () => {
  render(<ThemeToggle />);
  const toggle = screen.getByRole('button');
  fireEvent.click(toggle);
  expect(document.body).toHaveClass('dark-mode');
});
```

#### Integration Test (Cross-Service)
*Testing the bridge between FastAPI and the Node.js JS Plugin.*
```python
@pytest.mark.integration
def test_fastapi_to_js_plugin_communication(js_plugin_server):
    js_code = "function sum(a, b) { return a + b; }"
    metrics = get_file_matrix_js(js_code, "test.js")
    
    assert metrics is not None
    assert metrics.filename == "test.js"
    assert len(metrics.functions) >= 1
```

#### System Test (End-to-End Playwright)
*Validating the complete repository analysis flow.*
```javascript
test("Submit repository and view analysis results", async ({ page }) => {
  await seedAuthenticatedSession(page);
  await mockApplicationApis(page);

  await page.goto("/");
  await page.getByPlaceholder("Enter GitHub repository URL").fill(
    "https://github.com/Nukie90/CodeWorld.git"
  );
  await page.getByRole("button", { name: /next/i }).click();

  await page.waitForURL("**/results");
  await expect(page.getByText(/showing/i)).toBeVisible();
});
```

### Execution & Recording
- **Manual Execution**: Run via `npm test` or `pytest`.
- **Reporting**: Pytest generates `coverage.xml`; Playwright generates HTML reports with video traces of failures.

---

## 5. CI/CD Pipeline Integration

While currently localized for development efficiency, the project is designed for **GitHub Actions** integration.

### Proposed Workflow (`.github/workflows/main.yml`)
- **Triggers**: On every `push` to `main` and all `pull_requests`.
- **Stages**:
  1. **Lint**: Run `flake8` for Python and `eslint` for JS.
  2. **Backend Tests**: Run `pytest` with coverage report generation.
  3. **Frontend Tests**: Run `npm test`.
  4. **E2E Tests**: Run Playwright tests on a staging environment.
- **Gating**: Merges to `main` are blocked if any test stage fails or if code coverage drops below 30%.

---

## 6. Test Results and Defect Analysis

### Execution Statistics
| Suite | Total Tests | Passed | Failed | Pass Rate |
| :--- | :--- | :--- | :--- | :--- |
| Backend (Unit/Int) | 31 | 31 | 0 | 100% |
| Frontend (Unit) | 25 | 25 | 0 | 100% |
| E2E (System) | 6 | 6 | 0 | 100% |

### Defect Analysis
Our testing identified several critical bugs during development:
1. **3D Re-render Loop**: E2E tests caught an issue where the 3D island re-rendered on every file selection, killing performance. *Resolution*: Implemented `React.memo` and optimized state updates.
2. **Missing Token Handling**: Integration tests found that the API crashed when GitHub tokens expired. *Resolution*: Added robust 401 interceptors and session refresh logic.
3. **Complexity Calculation Overflow**: Unit tests revealed that highly nested functions produced negative complexity scores in edge cases. *Resolution*: Corrected the AST visitor logic in the Python analyzer.
4. **Babel LLOC Discrepancy**: Multi-language unit tests identified that the Node.js analyzer calculated 7 lines of code (LLOC) for triple-quoted JSX strings instead of the expected 5 due to newline wrapping. *Resolution*: Updated the LLOC counting engine to better mask non-executable template spacing.

---
**Report compiled for Senior Project: CodeWorld**
**Date**: March 30, 2026

## Appendix: Test Case to File Mapping

The table below maps the Requirement IDs (RID) and Test Case IDs (TCID) to the actual test files implemented in the CodeWorld repository.

| Requirement ID | TCID Range | Primary Test File(s) |
| :--- | :--- | :--- |
| **UF-01 / SF-01** | TC-001 - TC-005 | `backend/tests/test_auth.py`, `frontend/src/__tests__/Login.test.jsx` |
| **UF-02 / SF-02 / SF-04** | TC-006 - TC-009 | `backend/tests/test_repo_manager.py`, `backend/tests/test_repository_analysis.py` |
| **SF-03 / SF-05** | TC-010 - TC-017 | `backend/app/js_plugin/server.js` (Unit), `e2e/tests/app.spec.js` |
| **UF-03 / UF-04 / UF-10** | TC-016 - TC-018, TC-041 | `frontend/src/__tests__/BarChartVisualization.test.jsx`, `e2e/tests/app.spec.js` |
| **UF-05 / SF-11** | TC-019 - TC-021, TC-036 | `frontend/src/__tests__/ResultsSidebar.test.jsx` |
| **UF-06 / SF-07** | TC-022 - TC-025 | `frontend/src/__tests__/UseRepoBranches.test.jsx` |
| **UF-07 / SF-06** | TC-026 - TC-027 | `e2e/tests/app.spec.js` (Timeline Automation) |
| **UF-08 / SF-12** | TC-028 - TC-033 | `backend/tests/test_metrics.py`, `frontend/src/__tests__/SourceCodeViewer.test.jsx` |
| **SF-10** | TC-034 - TC-035 | `frontend/src/__tests__/FunctionTable.test.jsx` |
| **SF-13** | TC-038 - TC-040 | `backend/tests/test_api_failures.py` |
| **UF-11** | TC-042 | `frontend/src/__tests__/ThemeToggle.test.jsx` |

## Appendix B: Testing Stage Identification

The CodeWorld project employs a three-tier testing hierarchy to ensure quality across different levels of abstraction.

### 1. Unit Testing (Component/Logic Level)
*Focus: Isolated testing of functions and React components.*

- **Backend Logic**: `backend/tests/test_metrics.py` (Tests `ensure_file_total_cognitive_complexity`, `aggregate_metrics`).
- **Git Utilities**: `backend/tests/test_repo_manager.py` (Tests `_is_probably_git_spec`, `_to_full_url`).
- **Babel Core**: `backend/app/js_plugin/server.js` (Internally validates `calculateMetrics`, `calculateCognitiveComplexity`).
- **UI Components**: `frontend/src/__tests__` (Tests files like `ThemeToggle.test.jsx`, `BarChartVisualization.test.jsx`, and `FunctionTable.test.jsx`).

### 2. Integration Testing (Service/API Level)
*Focus: Communication between modules and external service bridges.*

- **OAuth Authentication**: `backend/tests/test_auth.py` (Validates `auth_routes.github_callback` and session token storage).
- **Service Bridge**: `backend/tests/test_js_plugin_integration.py` (Verifies the FastAPI to Node.js `server.js` REST communication).
- **Analysis Routes**: `backend/tests/test_repository_analysis.py` (Tests the end-to-end repository parsing workflow on the backend).
- **Error Handling**: `backend/tests/test_api_failures.py` (Ensures resilience when GitHub or local files are missing).

### 3. System Testing (End-to-End Flow)
*Focus: Validating the entire user journey in a simulated browser.*

- **File**: `e2e/tests/app.spec.js` (Playwright).
- **Scenarios**:
    - **Login Flow**: Complete flow from Home -> GitHub OAuth -> Dashboard.
    - **Repo Analysis**: User enters URL -> System clones and analyzes -> results displayed.
    - **Interactive Exploration**: User clicks towers in 3D visualization -> sidebar updates -> source code view opens.
