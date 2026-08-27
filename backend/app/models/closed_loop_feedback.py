from datetime import datetime
from typing import Optional
from pydantic import Field
from beanie import Indexed, Link
from app.models.base import BaseUUIDDocument
from app.models.optimization_recommendation import OptimizationRecommendation
from app.models.base import get_utc_now

class ClosedLoopFeedback(BaseUUIDDocument):
    """Belongs to CLFE module"""
    recommendation: Link[OptimizationRecommendation]
    predicted_savings: float
    actual_savings: float
    prediction_error: float
    verification_status: Indexed(str)
    feedback_notes: Optional[str] = None
    feedback_timestamp: Indexed(datetime) = Field(default_factory=get_utc_now)

    class Settings:
        name = "closed_loop_feedback"
        indexes = [
            "verification_status",
            "feedback_timestamp"
        ]
