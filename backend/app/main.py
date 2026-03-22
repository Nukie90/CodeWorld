from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes.github_routes import router as github_router
from app.routes.ai_routes import router as ai_router

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

app = FastAPI()

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
app.include_router(github_router, prefix="/api")
app.include_router(ai_router, prefix="/api/ai")

@app.get("/")
async def home():
    return {"message": "Welcome to CodeWorld"}

@app.get("/health")
async def health_check():
    return {"status": "ok"}

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="127.0.0.1", port=8000)
