from typing import Optional
from uuid import UUID
from datetime import datetime
from app.schemas.base import BaseSchema, BaseUUIDSchema
from app.schemas.optimization_recommendation import OptimizationRecommendationResponse

class RecommendationHistoryBase(BaseSchema):
    action_taken: str
    accepted: bool
    implemented_at: Optional[datetime] = None
    verified_at: Optional[datetime] = None

class RecommendationHistoryCreate(RecommendationHistoryBase):
    recommendation_id: UUID

class RecommendationHistoryUpdate(BaseSchema):
    action_taken: Optional[str] = None
    accepted: Optional[bool] = None
    implemented_at: Optional[datetime] = None
    verified_at: Optional[datetime] = None

class RecommendationHistoryResponse(RecommendationHistoryBase, BaseUUIDSchema):
    recommendation: OptimizationRecommendationResponse
