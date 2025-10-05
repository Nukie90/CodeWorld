from fastapi import HTTPException
from app.utils.get_file_matrix import get_file_matrix

async def analyze_file(file):
    filename = file.filename or ""

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

    analysis = get_file_matrix(text, filename)
    
    return {
        "filename": filename,
        "analysis": analysis,
    }
