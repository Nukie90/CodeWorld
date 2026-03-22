from fastapi import APIRouter, HTTPException, Body
from pydantic import BaseModel
from typing import List, Dict, Optional, Any
from app.services.ai_service import ai_service

router = APIRouter(tags=["ai"])

class ChatMessage(BaseModel):
    role: str
    content: str
    reasoning_details: Optional[str] = None

class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    project_context: Optional[Dict[str, Any]] = None

@router.post("/chat")
async def chat_with_ai(payload: ChatRequest):
    """
    Endpoint to chat with the AI assistant.
    Receives message history and current project context.
    """
    try:
        # Convert Pydantic models to dicts for the service
        messages_dicts = [m.dict() for m in payload.messages]
        
        response = await ai_service.get_chat_response(
            messages=messages_dicts,
            project_context=payload.project_context
        )
        
        return response
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
