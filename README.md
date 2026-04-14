#### CodeWorld
<video controls src="Demo.mp4" title="Title"></video>

**CodeWorld** is a comprehensive code analysis and metrics visualization platform designed to help developers understand, measure, and optimize their codebases. It provides a robust pipeline to seamlessly fetch, analyze, and visualize source code metrics directly from GitHub repositories. 

By integrating specialized AST (Abstract Syntax Tree) parsing plugins for both Python and JavaScript, CodeWorld calculates vital complexity metrics such as Cognitive Complexity, Cyclomatic Complexity, Halstead Volume, and Maintainability Index. The customizable dashboard features real-time visualizations for code quality insights, issue distributions (including fatal errors), and a fully Dockerized setup ensuring a streamlined and scalable deployment.
## Docker

1. docker compose up --build -d

## Backend

# Install ENV
1. cd backend
2. python -m venv venv || python3 -m venv venv

# To activate ENV
1. cd backend
2. source venv/bin/activate 
windows -> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
        -> venv\Scripts\activate
3. pip3 install -r requirements.txt

# Environment Variables
Create a `.env` file in the `backend` directory with:
```
GITHUB_CLIENT_ID=your_github_client_id
GITHUB_CLIENT_SECRET=your_github_client_secret
GITHUB_REDIRECT_URI=http://127.0.0.1:8000/api/auth/github/callback
```

# GitHub OAuth Setup
1. Go to GitHub → Settings → Developer settings → OAuth Apps
2. Create a new OAuth App or edit existing one
3. Set **Authorization callback URL** to: `http://127.0.0.1:8000/api/auth/github/callback`
   (Must match exactly the `GITHUB_REDIRECT_URI` in your `.env` file)
4. Copy the Client ID and Client Secret to your `.env` file

# Checking
1. cd backend
2. uvicorn app.main:app --reload

# Next Start JS Server port 3001
1. cd app/js_plugin
2. npm install
3. npm run dev

## Frontend
1. npm install
2. npm run dev

or using nvm
1. nvm list 
2. nvm use 23
3. npm install
4. npm run dev

## CI/CD Pipeline

This project uses **GitHub Actions** for Continuous Integration. The pipeline is defined in `.github/workflows/ci.yml`.

### Automated Triggers
The CI workflow automatically runs all test suites for:
- **Pull Requests** targeting the `main` branch.
- **Commits** pushed directly to the `main` branch.

### Test Suites Supported
- **Backend**: Runs `pytest` inside the Python environment.
- **Frontend**: Runs `eslint` and Jest tests via `npm run test`.
- **E2E**: Runs Playwright e2e checks via `npm run test:e2e`.

### Blocking Merges on Test Failure
To ensure code quality, the pipeline handles test failures by reporting a failed status check. You should configure branch protection rules in GitHub to block PR merges if these tests fail:
1. Go to your GitHub repository -> **Settings** -> **Branches**.
2. Click **Add branch protection rule** (or edit the rule for `main`).
3. Check **"Require status checks to pass before merging"**.
4. Search for and select the status checks from the pipeline (e.g., `backend-tests`, `frontend-tests`, `e2e-tests`).
5. Save changes. This will prevent anyone from merging a PR that breaks the tests!
