from fastapi import APIRouter, UploadFile, File, HTTPException

from app.services.lizard_services import analyze_code

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

    analysis = analyze_code(text)

    return {
        "filename": filename,
        "analysis": analysis,
    }
