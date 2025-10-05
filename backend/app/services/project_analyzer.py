import os
from app.services.file_analyzer import analyze_file
from app.utils.file_utils import get_all_files
import lizard

def analyze_project(path: str):
    if not os.path.isdir(path):
        return {"error": "Invalid project path"}

    result = list(lizard.analyze(path))
    
    print(result)
    
    project_summary = {
        "success": True,
        "analysis": result
    }
    
    return project_summary

