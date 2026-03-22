from fastapi import APIRouter, HTTPException
from typing import Optional
from pydantic import BaseModel
from app.model.analyzer_model import FileLint

router = APIRouter(tags=["lint"])

class LintRequest(BaseModel):
    repo_url: str
    commit_hash: str
    token: Optional[str] = None

@router.post("/lint/{file_name:path}", response_model=FileLint)
async def lint_file(file_name: str, payload: LintRequest):
    from app.services import repo_manager
    try:
        content = repo_manager.get_file_content(
            payload.repo_url,
            payload.commit_hash,
            file_name,
            token=payload.token
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to get file content: {str(exc)}")

    from app.adapter.factory import get_adapters
    for adapter in get_adapters():
        if adapter.supports(file_name):
            result = await adapter.lint_content(content, file_name)
            if result:
                return result
            # break here to prevent falling through if an adapter matches but returns None
            break

    return FileLint(lint_score=None, lint_errors=[])
