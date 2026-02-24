"""Health check endpoint."""

from fastapi import APIRouter

from api.schemas import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Check if the service is running and models are loaded."""
    from api.main import models_loaded

    return HealthResponse(
        status="healthy" if models_loaded else "degraded",
        models_loaded=models_loaded,
        version="1.0.0",
    )
