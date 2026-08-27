from typing import List, Optional, Any, Dict
from uuid import UUID
from fastapi import APIRouter, Depends, Query, HTTPException
from app.models.user import User
from app.schemas.cloud_resource import CloudResourceCreate, CloudResourceUpdate, CloudResourceResponse
from app.services.cloud_resource_service import CloudResourceService
from app.api.dependencies.auth import get_current_user, get_current_engineer, get_current_analyst

router = APIRouter()

@router.get("/dashboard/summary", summary="Dashboard Summary", description="Retrieves aggregated metrics on resources.")
async def dashboard_summary(current_user: User = Depends(get_current_analyst)) -> Dict[str, Any]:
    return await CloudResourceService.get_dashboard_summary()

@router.get("/search", response_model=List[CloudResourceResponse], summary="Search Resources")
async def search_resources(
    q: str = Query(..., min_length=1, description="Search query string"),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_analyst)
):
    """Search for cloud resources by Resource Name, Service, Owner, or Project Name."""
    return await CloudResourceService.get_resources(skip=skip, limit=limit, search=q)

@router.get("/filter", response_model=List[CloudResourceResponse], summary="Filter Resources")
async def filter_resources(
    region: Optional[str] = Query(None),
    environment: Optional[str] = Query(None),
    status: Optional[str] = Query(None),
    provider_id: Optional[UUID] = Query(None),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_analyst)
):
    """Filter resources by specific dimensions like region, env, etc."""
    return await CloudResourceService.get_resources(
        skip=skip, limit=limit, region=region, environment=environment, status=status, provider_id=provider_id
    )

@router.get("/provider/{provider_id}", response_model=List[CloudResourceResponse], summary="Resources by Provider")
async def resources_by_provider(provider_id: UUID, current_user: User = Depends(get_current_analyst)):
    return await CloudResourceService.get_resources(provider_id=provider_id)

@router.get("/region/{region}", response_model=List[CloudResourceResponse], summary="Resources by Region")
async def resources_by_region(region: str, current_user: User = Depends(get_current_analyst)):
    return await CloudResourceService.get_resources(region=region)

@router.get("/environment/{environment}", response_model=List[CloudResourceResponse], summary="Resources by Environment")
async def resources_by_environment(environment: str, current_user: User = Depends(get_current_analyst)):
    return await CloudResourceService.get_resources(environment=environment)

@router.get("/status/{status}", response_model=List[CloudResourceResponse], summary="Resources by Status")
async def resources_by_status(status: str, current_user: User = Depends(get_current_analyst)):
    return await CloudResourceService.get_resources(status=status)

@router.get("/", response_model=List[CloudResourceResponse], summary="List Resources")
async def list_resources(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    sort_by: str = Query("created_at"),
    descending: bool = Query(True),
    current_user: User = Depends(get_current_analyst)
):
    return await CloudResourceService.get_resources(skip=skip, limit=limit, sort_by=sort_by, descending=descending)

@router.get("/{resource_id}", response_model=CloudResourceResponse, summary="Get Resource")
async def get_resource(resource_id: UUID, current_user: User = Depends(get_current_analyst)):
    resource = await CloudResourceService.get_resource(resource_id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    return resource

@router.post("/", response_model=CloudResourceResponse, summary="Create Resource", status_code=201)
async def create_resource(resource_in: CloudResourceCreate, current_user: User = Depends(get_current_engineer)):
    try:
        return await CloudResourceService.create_resource(resource_in, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{resource_id}", response_model=CloudResourceResponse, summary="Update Resource")
async def update_resource(resource_id: UUID, update_in: CloudResourceUpdate, current_user: User = Depends(get_current_engineer)):
    resource = await CloudResourceService.update_resource(resource_id, update_in, current_user.id)
    if not resource:
        raise HTTPException(status_code=404, detail="Resource not found")
    return resource

@router.delete("/{resource_id}", summary="Delete Resource")
async def delete_resource(resource_id: UUID, current_user: User = Depends(get_current_engineer)):
    success = await CloudResourceService.delete_resource(resource_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Resource not found")
    return {"success": True, "message": "Resource deleted."}
