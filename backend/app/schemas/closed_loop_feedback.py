from typing import Optional
from uuid import UUID
from datetime import datetime
from app.schemas.base import BaseSchema, BaseUUIDSchema
from app.schemas.optimization_recommendation import OptimizationRecommendationResponse

class ClosedLoopFeedbackBase(BaseSchema):
    predicted_savings: float
    actual_savings: float
    prediction_error: float
    verification_status: str
    feedback_notes: Optional[str] = None
    feedback_timestamp: Optional[datetime] = None

class ClosedLoopFeedbackCreate(ClosedLoopFeedbackBase):
    recommendation_id: UUID

class ClosedLoopFeedbackUpdate(BaseSchema):
    predicted_savings: Optional[float] = None
    actual_savings: Optional[float] = None
    prediction_error: Optional[float] = None
    verification_status: Optional[str] = None
    feedback_notes: Optional[str] = None

class ClosedLoopFeedbackResponse(ClosedLoopFeedbackBase, BaseUUIDSchema):
    recommendation: OptimizationRecommendationResponse
