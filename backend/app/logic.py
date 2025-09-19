from typing import Dict


async def get_root_message() -> Dict[str, str]:
    """Return a welcome message for the API root endpoint."""
    return {"message": "Hello from CodeWorld FastAPI"}


async def get_health_status() -> Dict[str, str]:
    """Return the service health status."""
    return {"status": "ok"}
