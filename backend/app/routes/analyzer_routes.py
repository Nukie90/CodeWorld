from string import printable
from fastapi import APIRouter, UploadFile, File
from app.adapter.factory import get_analysis_adapter
from app.utils.normalize import normalize_node_metrics, normalize_node_zip
from app.services.analyze_folder import analyze_folder

router = APIRouter(tags=["analyzer"])

# For now, we are hardcoding the adapter type. In the future, this could be read from a config file.
ADAPTER_TYPE = "js-plugin"

# @router.post("/analyze-file")
# async def analyze_file(file: UploadFile = File(...)):
#     adapter = get_analysis_adapter(ADAPTER_TYPE)
#     node_json = await adapter.analyze_file(file)
#     normalize_metric = normalize_node_metrics(node_json, filename=file.filename)
#     return {
#         "filename": file.filename,
#         "analysis": normalize_metric,
#     }

# @router.post("/analyze-zip")
# async def analyze_zip(file: UploadFile = File(...)):
#     adapter = get_analysis_adapter(ADAPTER_TYPE)
#     node_json = await adapter.analyze_zip(file)
#     folder_name = file.filename.rsplit(".", 1)[0]
#     return normalize_node_zip(node_json, folder_name)

@router.post("/uploadfolder")
async def upload_folder(file: UploadFile = File(...)):
    print("IS USED")
    return await analyze_folder(file)
