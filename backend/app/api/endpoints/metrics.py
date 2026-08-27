from typing import List, Dict, Any, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query, HTTPException
from app.models.user import User
from app.schemas.resource_metric import ResourceMetricCreate, ResourceMetricUpdate, ResourceMetricResponse
from app.services.resource_metric_service import ResourceMetricService
from app.api.dependencies.auth import get_current_user, get_current_engineer, get_current_analyst

router = APIRouter()

@router.get("/dashboard", summary="Dashboard Statistics", description="Retrieves aggregated metrics over a timeline")
async def dashboard_summary(current_user: User = Depends(get_current_analyst)):
    return await ResourceMetricService.get_dashboard_summary()

@router.get("/latest/{resource_id}", response_model=Optional[ResourceMetricResponse], summary="Latest Metric", description="Gets the most recent metric for a resource")
async def get_latest_metric(resource_id: UUID, current_user: User = Depends(get_current_analyst)):
    return await ResourceMetricService.get_latest_metric(resource_id)

@router.get("/history/{resource_id}", response_model=List[ResourceMetricResponse], summary="History Metrics", description="Get full historical metric graph for resource")
async def get_history_metrics(
    resource_id: UUID, 
    skip: int = 0, 
    limit: int = 200, 
    current_user: User = Depends(get_current_analyst)
):
    return await ResourceMetricService.get_metrics(skip=skip, limit=limit, resource_id=resource_id)

@router.get("/resource/{resource_id}", response_model=List[ResourceMetricResponse], summary="Metrics by Resource")
async def get_metrics_by_resource(resource_id: UUID, current_user: User = Depends(get_current_analyst)):
    return await ResourceMetricService.get_metrics(resource_id=resource_id)

@router.get("/", response_model=List[ResourceMetricResponse], summary="List Metrics")
async def list_metrics(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    current_user: User = Depends(get_current_analyst)
):
    return await ResourceMetricService.get_metrics(skip=skip, limit=limit)

@router.get("/{metric_id}", response_model=ResourceMetricResponse, summary="Get Metric")
async def get_metric(metric_id: UUID, current_user: User = Depends(get_current_analyst)):
    metric = await ResourceMetricService.get_metric(metric_id)
    if not metric:
        raise HTTPException(status_code=404, detail="Metric not found")
    return metric

@router.post("/", response_model=ResourceMetricResponse, summary="Create Metric", status_code=201)
async def create_metric(metric_in: ResourceMetricCreate, current_user: User = Depends(get_current_engineer)):
    try:
        return await ResourceMetricService.create_metric(metric_in, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.put("/{metric_id}", response_model=ResourceMetricResponse, summary="Update Metric")
async def update_metric(metric_id: UUID, update_in: ResourceMetricUpdate, current_user: User = Depends(get_current_engineer)):
    try:
        metric = await ResourceMetricService.update_metric(metric_id, update_in, current_user.id)
        if not metric:
            raise HTTPException(status_code=404, detail="Metric not found")
        return metric
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{metric_id}", summary="Delete Metric")
async def delete_metric(metric_id: UUID, current_user: User = Depends(get_current_engineer)):
    success = await ResourceMetricService.delete_metric(metric_id, current_user.id)
    if not success:
        raise HTTPException(status_code=404, detail="Metric not found")
    return {"success": True, "message": "Metric deleted."}
