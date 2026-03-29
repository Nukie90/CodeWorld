# Unit Testing Report Tables

The tables below summarize the current automated unit-testing evidence for CodeWorld.

## 1. Unit Testing Summary

| Area | Tooling | Test files | Test design techniques | Result |
| --- | --- | --- | --- | --- |
| Backend helper and model logic | `pytest`, `pytest-cov` | `backend/tests/unit/test_ignore.py`, `backend/tests/unit/test_analysis_helpers.py`, `backend/tests/unit/test_repo_manager_helpers.py` | assertions, boundary checks, pairwise combinations, branch coverage measurement | `24/24` tests passed |
| Frontend utility logic | `vitest`, `@vitest/coverage-v8`, `jsdom` | `frontend/src/utils/formatFileSize.test.js`, `frontend/src/utils/SceneDiffer.test.js`, `frontend/src/utils/audioManager.test.js` | boundary value analysis, behavioral state testing, branch coverage measurement | `21/21` tests passed |
| Combined unit test total | `pytest` + `vitest` | 6 automated unit test files | BVA, pairwise, branch-aware unit testing | `45/45` tests passed |

## 2. Coverage Metrics

### Backend coverage with branch measurement

Command used:

```bash
cd backend
./venv/bin/pytest tests/unit \
  --cov=app.utils.analysis_helpers \
  --cov=app.utils.ignore \
  --cov=app.services.repo_manager \
  --cov=app.model.analyzer_model \
  --cov-branch \
  --cov-report=term-missing
```

| Backend target | Statement coverage | Branch coverage / note |
| --- | --- | --- |
| `app/model/analyzer_model.py` | `100%` | no branches in this file |
| `app/utils/analysis_helpers.py` | `97%` | `92%` overall file coverage with branch tracking enabled |
| `app/utils/ignore.py` | `80%` | branch tracking enabled |
| `app/services/repo_manager.py` | `20%` | branch tracking enabled; low because clone/fetch/checkout/history flows are not unit-isolated yet |
| Selected backend total | `49%` | branch tracking enabled across the measured modules |

### Frontend coverage

Command used:

```bash
cd frontend
npm run test:coverage
```

| Frontend target | Statements | Branches | Functions | Lines |
| --- | --- | --- | --- | --- |
| `src/utils/formatFileSize.js` | `100%` | `100%` | `100%` | `100%` |
| `src/utils/SceneDiffer.js` | `100%` | `91.3%` | `100%` | `100%` |
| `src/utils/audioManager.js` | `92.3%` | `80%` | `83.33%` | `92.3%` |
| Selected frontend total | `96.38%` | `88%` | `90%` | `96.38%` |

## 3. Test Design Technique Evidence

| Technique | Target | Evidence |
| --- | --- | --- |
| Boundary Value Analysis | `frontend/src/utils/formatFileSize.js` | just-below, at, and just-above boundaries for `0`, `1024`, `10 KB`, `1 MB`, and the `TB` cap |
| Pairwise testing | `_to_full_url()` + `_normalize_url()` in `backend/app/services/repo_manager.py` | pairwise matrix across repository form, whitespace, and trailing slash |
| Branch coverage | backend helper/model slice and frontend utility slice | measured with `pytest-cov --cov-branch` and Vitest V8 coverage |

## 4. Notes for the report

| Observation | Report wording |
| --- | --- |
| Backend branch coverage is lower than frontend coverage | The first unit-testing pass focused on pure helper functions and normalization logic; Git and network-heavy repository workflows remain for future unit isolation or integration testing. |
| Pairwise tests revealed a normalization edge case | A short repository spec with a trailing slash is currently trimmed to `owner/repo` rather than expanded to a full GitHub HTTPS URL; this behavior is now documented and regression-tested. |
| Frontend utility coverage is strong | Core utility formatting, diffing, and audio-state logic are now covered by repeatable automated tests with quantitative coverage metrics. |
