from typing import Optional
from uuid import UUID
from datetime import datetime
from app.schemas.base import BaseSchema, BaseUUIDSchema
from app.schemas.cloud_resource import CloudResourceResponse

class OptimizationRecommendationBase(BaseSchema):
    recommendation_title: str
    recommendation_description: str
    recommended_action: str
    predicted_savings: float
    estimated_impact: str
    priority: str
    status: str = "pending"
    generated_at: Optional[datetime] = None

class OptimizationRecommendationCreate(OptimizationRecommendationBase):
    resource_id: UUID

class OptimizationRecommendationUpdate(BaseSchema):
    recommendation_title: Optional[str] = None
    recommendation_description: Optional[str] = None
    recommended_action: Optional[str] = None
    predicted_savings: Optional[float] = None
    estimated_impact: Optional[str] = None
    priority: Optional[str] = None
    status: Optional[str] = None

class OptimizationRecommendationResponse(OptimizationRecommendationBase, BaseUUIDSchema):
    resource: CloudResourceResponse
