from fastapi import APIRouter, UploadFile, File, HTTPException
import os
import httpx
from app.adapters.normalize import normalize_node_metrics, normalize_node_zip

router = APIRouter(tags=["analyzer"])
NODE_METRICS_URL = os.getenv("NODE_METRICS_URL", "http://localhost:3001")

@router.post("/analyze-file")
async def analyze_file(file: UploadFile = File(...)):
    content = await file.read()
    async with httpx.AsyncClient(timeout=60) as client:
        r = await client.post(
            f"{NODE_METRICS_URL}/analyze",
            files={"file": (file.filename, content, "application/octet-stream")},
        )
    if r.status_code != 200:
        raise HTTPException(502, f"Node error: {r.text}")
    node_json = r.json()
    normalize_metric = normalize_node_metrics(node_json, filename=file.filename)
    return {
        "filename": file.filename,
        "analysis": normalize_metric,
    }
    
@router.post("/analyze-zip")
async def analyze_zip(file: UploadFile = File(...)):
    content = await file.read()
    print("Forwarding zip file to Node server for analysis...")
    async with httpx.AsyncClient(timeout=300) as client:
        r = await client.post(f"{NODE_METRICS_URL}/analyze-zip", files={"file": (file.filename, content, "application/zip")})
    if r.status_code != 200:
        raise HTTPException(502, f"Node error: {r.text}")
    node_json = r.json()
    folder_name = file.filename.rsplit(".", 1)[0]
    return normalize_node_zip(node_json, folder_name)