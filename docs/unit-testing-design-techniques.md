# Unit Testing Design Techniques

This file documents the explicit test design techniques added for the first unit-testing pass.

## 1. Boundary Value Analysis

Target function:
- `frontend/src/utils/formatFileSize.js`

Why BVA fits:
- The function has hard numeric boundaries that change behavior:
- invalid/non-positive input at `0`
- unit transitions at `1024^n`
- formatting transition at `size >= 10`
- maximum displayed unit capped at `TB`

Implemented boundaries:

| Boundary | Test values |
| --- | --- |
| Lower valid bound | `-1`, `0`, `1` |
| Bytes -> KB | `1023`, `1024`, `1025` |
| Decimal -> integer formatting inside KB | `10239`, `10240`, `10241` |
| KB -> MB | `1048575`, `1048576` |
| Max unit cap | `1024^5` |

Implemented in:
- `frontend/src/utils/formatFileSize.test.js`

## 2. Pairwise Testing

Target logic:
- `backend/app/services/repo_manager.py`
- composition of `_to_full_url()` and `_normalize_url()`

Why pairwise fits:
- The canonicalized repository string depends on multiple input dimensions that interact:
- repository form
- surrounding whitespace
- trailing slash

Factors and values:

| Factor | Values |
| --- | --- |
| Repository form | short `owner/repo`, `https`, `ssh` |
| Surrounding whitespace | none, padded |
| Trailing slash | absent, present |

Selected pairwise matrix:

| Case ID | Repository form | Whitespace | Trailing slash |
| --- | --- | --- | --- |
| `pairwise-short-none-no-slash` | short | none | absent |
| `pairwise-short-padded-with-slash` | short | padded | present |
| `pairwise-https-none-with-slash` | https | none | present |
| `pairwise-https-padded-no-slash` | https | padded | absent |
| `pairwise-ssh-none-no-slash` | ssh | none | absent |
| `pairwise-ssh-padded-with-slash` | ssh | padded | present |

This set covers every pair across the three factors without requiring all `3 x 2 x 2 = 12` combinations.

Observed behavior captured by the tests:
- short specs with a trailing slash are trimmed to `owner/repo`, but are not expanded into `https://github.com/...git`

Implemented in:
- `backend/tests/unit/test_repo_manager_helpers.py`
