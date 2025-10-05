from fastapi import APIRouter
from app.services import project_analyzer, file_analyzer

router = APIRouter()

@router.get("/project")
def analyze_project(path: str = '/Users/roshan/Desktop/Uni/CodeWorld/backend/app'):
    """Analyze the whole project folder."""
    return project_analyzer.analyze_project(path)

@router.get("/file")
def analyze_file(path: str = '/Users/roshan/Desktop/Uni/CodeWorld/backend/app/api/routes_analysis.py'):
    """Analyze a single file."""
    return file_analyzer.analyze_file(path)
