from fastapi import APIRouter, UploadFile, File

from app.services.analyze_file import analyze_file
from app.services.analyze_folder import analyze_folder

router = APIRouter(tags=["analyzer"])

@router.post("/uploadfile")
async def upload_file(file: UploadFile = File(...)):
    return await analyze_file(file)

@router.post("/uploadfolder")
async def upload_folder(file: UploadFile = File(...)):
    return await analyze_folder(file)
