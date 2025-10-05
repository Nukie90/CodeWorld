from fastapi import FastAPI
from fastapi import APIRouter
from app.api.routes_analysis import router as analysis_router

app = FastAPI(title="Project Analyzer API")

api_router = APIRouter(prefix="/api")

api_router.include_router(analysis_router, prefix="/analyze", tags=["analysis"])

app.include_router(api_router)

@app.get("/")
def root():
    return {"message": "Project Analyzer API is running"}
