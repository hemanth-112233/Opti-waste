from fastapi import APIRouter
from app.api.endpoints import providers, resources

api_router = APIRouter()

@api_router.get("/")
def read_root():
    return {"message": "Welcome to OptiWaste API"}

api_router.include_router(providers.router, prefix="/providers", tags=["Cloud Providers"])
api_router.include_router(resources.router, prefix="/resources", tags=["Cloud Resources"])
