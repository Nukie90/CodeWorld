from fastapi import HTTPException
from app.utils.get_folder_matrix import get_folder_matrix

async def analyze_folder(file):
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
        analysis_result = await get_folder_matrix(data, folder_name)
        
        return {
            "folder_name": folder_name,
            "analysis": analysis_result,
        }
    except Exception as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to analyze folder: {str(exc)}",
        ) from exc
 