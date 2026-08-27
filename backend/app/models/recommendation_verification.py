from datetime import datetime
from pydantic import Field
from beanie import Indexed, Link
from app.models.base import BaseUUIDDocument
from app.models.optimization_recommendation import OptimizationRecommendation
from app.models.base import get_utc_now

class RecommendationVerification(BaseUUIDDocument):
    """Belongs to RVE module"""
    recommendation: Link[OptimizationRecommendation]
    verification_status: Indexed(str)
    predicted_savings: float
    estimated_risk: str
    confidence_score: float
    verified_at: Indexed(datetime) = Field(default_factory=get_utc_now)

    class Settings:
        name = "recommendation_verifications"
        indexes = [
            "verification_status",
            "verified_at"
        ]
