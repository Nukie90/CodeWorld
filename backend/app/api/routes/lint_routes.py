from fastapi import APIRouter, HTTPException
from typing import Optional
from pydantic import BaseModel
from app.model.analyzer_model import FileLint
from app.services.state_manager import get_session

router = APIRouter(tags=["lint"])

class LintRequest(BaseModel):
    repo_url: str
    commit_hash: str
    token: Optional[str] = None

@router.post("/lint/{file_name:path}", response_model=FileLint)
async def lint_file(file_name: str, payload: LintRequest):
    from app.services import repo_manager
    github_token = None
    if payload.token and payload.token.strip():
        session = get_session(payload.token)
        if not session:
            raise HTTPException(
                status_code=401,
                detail="Session expired. Please log in with GitHub again.",
            )
        github_token = session["github_token"]
    try:
        content = repo_manager.get_file_content(
            payload.repo_url,
            payload.commit_hash,
            file_name,
            token=github_token
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

    return FileLint(
        lint_score=None,
        lint_errors=[],
        is_not_applicable=True,
        not_applicable_reason="Linting is not available for this file type.",
    )
