from fastapi import APIRouter, UploadFile, File, HTTPException

from app.services.lizard_services import analyze_js, analyze_folder

router = APIRouter(tags=["analysis"])

ALLOWED_EXTENSIONS = {".js", ".jsx"}


@router.post("/uploadfile")
async def upload_file(file: UploadFile = File(...)):
    filename = file.filename or ""
    lower_name = filename.lower()
    if not any(lower_name.endswith(ext) for ext in ALLOWED_EXTENSIONS):
        raise HTTPException(
            status_code=400,
            detail="Only JavaScript (.js) and JSX (.jsx) files are supported.",
        )

    try:
        data = await file.read()
    except Exception as exc:  # pragma: no cover - transport error
        raise HTTPException(status_code=500, detail="Failed to read uploaded file.") from exc
    finally:
        await file.close()

    if not data:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        text = data.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise HTTPException(
            status_code=400,
            detail="Uploaded file must be UTF-8 encoded text.",
        ) from exc

    analysis = analyze_js(text, filename)
    
    return {
        "filename": filename,
        "analysis": analysis,
    }

@router.post("/uploadfolder")
async def upload_folder(file: UploadFile = File(...)):
    filename = file.filename or ""
    
    # Check if it's a zip file
    if not filename.lower().endswith('.zip'):
        raise HTTPException(
            status_code=400,
            detail="Only ZIP files are supported for folder uploads.",
        )

    try:
        data = await file.read()
    except Exception as exc:  # pragma: no cover - transport error
        raise HTTPException(status_code=500, detail="Failed to read uploaded file.") from exc
    finally:
        await file.close()

    if not data:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        # Extract folder name from zip filename
        folder_name = filename.rsplit('.', 1)[0]  # Remove .zip extension
        analysis_result = analyze_folder(data, folder_name)
        
        return {
            "folder_name": folder_name,
            "analysis": analysis_result,
        }
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to analyze folder: {str(exc)}",
        ) from exc
