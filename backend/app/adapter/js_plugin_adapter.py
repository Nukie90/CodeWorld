import httpx
from fastapi import UploadFile, HTTPException
from app.adapter.adapter import AnalysisAdapter
import os

NODE_METRICS_URL = os.getenv("NODE_METRICS_URL", "http://localhost:3001")

class JSPluginAdapter(AnalysisAdapter):
    async def analyze_file(self, file: UploadFile):
        content = await file.read()
        async with httpx.AsyncClient(timeout=60) as client:
            r = await client.post(
                f"{NODE_METRICS_URL}/analyze",
                files={"file": (file.filename, content, "application/octet-stream")},
            )
        if r.status_code != 200:
            raise HTTPException(502, f"Node error: {r.text}")
        return r.json()

    async def analyze_zip(self, file: UploadFile):
        print("IS USED")
        content = await file.read()
        print("Forwarding zip file to Node server for analysis...")
        async with httpx.AsyncClient(timeout=300) as client:
            r = await client.post(f"{NODE_METRICS_URL}/analyze-zip", files={"file": (file.filename, content, "application/zip")})
        if r.status_code != 200:
            raise HTTPException(502, f"Node error: {r.text}")
        return r.json()
