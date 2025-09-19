from fastapi import APIRouter

from .logic import get_health_status, get_root_message

router = APIRouter()


@router.get("/")
async def root():
    """Root endpoint for the API."""
    return await get_root_message()


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return await get_health_status()
