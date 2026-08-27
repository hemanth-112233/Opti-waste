from fastapi import APIRouter
from app.api.endpoints import providers, resources, metrics, costs

api_router = APIRouter()
api_router.include_router(providers.router, prefix="/providers", tags=["Cloud Providers"])
api_router.include_router(resources.router, prefix="/resources", tags=["Cloud Resources"])
api_router.include_router(metrics.router, prefix="/metrics", tags=["Resource Metrics"])
api_router.include_router(costs.router, prefix="/costs", tags=["Cost Records"])
