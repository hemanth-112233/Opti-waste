from typing import Optional
from uuid import UUID
from datetime import datetime
from app.schemas.base import BaseSchema, BaseUUIDSchema
from app.schemas.optimization_recommendation import OptimizationRecommendationResponse

class RecommendationVerificationBase(BaseSchema):
    verification_status: str
    predicted_savings: float
    estimated_risk: str
    confidence_score: float
    verified_at: Optional[datetime] = None

class RecommendationVerificationCreate(RecommendationVerificationBase):
    recommendation_id: UUID

class RecommendationVerificationUpdate(BaseSchema):
    verification_status: Optional[str] = None
    predicted_savings: Optional[float] = None
    estimated_risk: Optional[str] = None
    confidence_score: Optional[float] = None

class RecommendationVerificationResponse(RecommendationVerificationBase, BaseUUIDSchema):
    recommendation: OptimizationRecommendationResponse
