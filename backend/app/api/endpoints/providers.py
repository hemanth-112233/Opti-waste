from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, Query, HTTPException
from app.models.user import User
from app.schemas.cloud_provider import CloudProviderCreate, CloudProviderUpdate, CloudProviderResponse
from app.services.cloud_provider_service import CloudProviderService
from app.api.dependencies.auth import get_current_user, get_current_engineer, get_current_analyst

router = APIRouter()

@router.get("/", response_model=List[CloudProviderResponse], summary="List Providers", description="Get a list of all cloud providers with pagination.")
async def list_providers(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_analyst)
):
    return await CloudProviderService.get_providers(skip=skip, limit=limit)

@router.get("/{provider_id}", response_model=CloudProviderResponse, summary="Get Provider", description="Get details of a specific cloud provider.")
async def get_provider(
    provider_id: UUID,
    current_user: User = Depends(get_current_analyst)
):
    provider = await CloudProviderService.get_provider(provider_id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    return provider

@router.post("/", response_model=CloudProviderResponse, summary="Create Provider", description="Register a new cloud provider.", status_code=201)
async def create_provider(
    provider_in: CloudProviderCreate,
    current_user: User = Depends(get_current_engineer) # Engineer or Admin can create
):
    return await CloudProviderService.create_provider(provider_in, current_user.id)

@router.put("/{provider_id}", response_model=CloudProviderResponse, summary="Update Provider", description="Update an existing cloud provider.")
async def update_provider(
    provider_id: UUID,
    update_in: CloudProviderUpdate,
    current_user: User = Depends(get_current_engineer)
):
    provider = await CloudProviderService.update_provider(provider_id, update_in, current_user.id)
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    return provider

@router.delete("/{provider_id}", summary="Delete Provider", description="Remove a cloud provider entirely.")
async def delete_provider(
    provider_id: UUID,
    current_user: User = Depends(get_current_engineer)
):
    success = await CloudProviderService.delete_provider(provider_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Provider not found")
    return {"success": True, "message": "Provider deleted."}
