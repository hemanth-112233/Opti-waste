from typing import List, Dict, Any, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query, HTTPException
from app.models.user import User
from app.schemas.cost_record import CostRecordCreate, CostRecordUpdate, CostRecordResponse
from app.services.cost_record_service import CostRecordService
from app.api.dependencies.auth import get_current_user, get_current_engineer, get_current_analyst

router = APIRouter()

@router.get("/dashboard", summary="Dashboard Statistics", description="Retrieves aggregated costs")
async def dashboard_summary(current_user: User = Depends(get_current_analyst)):
    return await CostRecordService.get_dashboard_summary()

@router.get("/monthly", response_model=List[CostRecordResponse], summary="Monthly Costs", description="Get specifically costs by a billing_period query")
async def get_costs_monthly(
    billing_period: str = Query(..., description="YYYY-MM"),
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_analyst)
):
    return await CostRecordService.get_costs(skip=skip, limit=limit, billing_period=billing_period)

@router.get("/provider/{provider_id}", response_model=List[CostRecordResponse], summary="Costs by Provider")
async def get_costs_by_provider(provider_id: UUID, current_user: User = Depends(get_current_analyst)):
    return await CostRecordService.get_costs(provider_id=provider_id)

@router.get("/resource/{resource_id}", response_model=List[CostRecordResponse], summary="Costs by Resource")
async def get_costs_by_resource(resource_id: UUID, current_user: User = Depends(get_current_analyst)):
    return await CostRecordService.get_costs(resource_id=resource_id)

@router.get("/", response_model=List[CostRecordResponse], summary="List Costs")
async def list_costs(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_analyst)
):
    return await CostRecordService.get_costs(skip=skip, limit=limit)

@router.get("/{cost_id}", response_model=CostRecordResponse, summary="Get Cost")
async def get_cost(cost_id: UUID, current_user: User = Depends(get_current_analyst)):
    cost = await CostRecordService.get_cost(cost_id)
    if not cost:
        raise HTTPException(status_code=404, detail="Cost not found")
    return cost

@router.post("/", response_model=CostRecordResponse, summary="Create Cost", status_code=201)
async def create_cost(cost_in: CostRecordCreate, current_user: User = Depends(get_current_engineer)):
    try:
        return await CostRecordService.create_cost(cost_in, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{cost_id}", response_model=CostRecordResponse, summary="Update Cost")
async def update_cost(cost_id: UUID, update_in: CostRecordUpdate, current_user: User = Depends(get_current_engineer)):
    try:
        cost = await CostRecordService.update_cost(cost_id, update_in, current_user.id)
        if not cost:
            raise HTTPException(status_code=404, detail="Cost not found")
        return cost
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{cost_id}", summary="Delete Cost")
async def delete_cost(cost_id: UUID, current_user: User = Depends(get_current_engineer)):
    success = await CostRecordService.delete_cost(cost_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Cost not found")
    return {"success": True, "message": "Cost deleted."}
