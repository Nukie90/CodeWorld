from fastapi import FastAPI, UploadFile, File, Depends
from fastapi.middleware.cors import CORSMiddleware
from app.routes.analyzer_routes import router as analyzer_router
import os
from typing import Dict, Any
import httpx
from fastapi import HTTPException
from app.model.analyzer_model import CodeRequest
from app.adapters.normalize import normalize_node_metrics, normalize_node_zip

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

NODE_METRICS_URL = os.getenv("NODE_METRICS_URL", "http://localhost:3001")

app.include_router(analyzer_router, prefix="/api")

@app.get("/")
async def home():
    return {"message": "Welcome to CodeWorld"}

@app.get("/health")
async def health_check():
    return {"status": "ok"}


@app.post("/api/metrics/analyze-file")
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

@app.post("/api/metrics/analyze-zip")
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

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
