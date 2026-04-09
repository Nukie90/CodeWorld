from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes.auth_routes import router as auth_router
from app.api.routes.repo_routes import router as repo_router
from app.api.routes.analyze_routes import router as analyze_router
from app.api.routes.lint_routes import router as lint_router
from app.api.routes.user_routes import router as user_router
from contextlib import asynccontextmanager
from app.db.database import init_db

# Load environment variables from backend/.env when available (development convenience).
try:
    from dotenv import load_dotenv
    import pathlib

    BASE_DIR = pathlib.Path(__file__).resolve().parent.parent
    print("Loading env from", BASE_DIR / ".env")
    load_dotenv(BASE_DIR / ".env")
except Exception:
    # If python-dotenv isn't installed or .env doesn't exist, continue silently.
    print("env not loaded")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    yield
    # Shutdown

app = FastAPI(lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:5174",
        "http://localhost:5174",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# app.include_router(analyzer_router, prefix="/api")
app.include_router(auth_router, prefix="/api")
app.include_router(repo_router, prefix="/api")
app.include_router(analyze_router, prefix="/api")
app.include_router(lint_router, prefix="/api")
app.include_router(user_router, prefix="/api")

@app.get("/")
async def home():
    return {"message": "Welcome to CodeWorld"}

@app.get("/health")
async def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
