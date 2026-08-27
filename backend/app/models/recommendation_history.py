from datetime import datetime
from typing import Optional
from pydantic import Field
from beanie import Indexed, Link
from app.models.base import BaseUUIDDocument
from app.models.optimization_recommendation import OptimizationRecommendation
from app.models.base import get_utc_now

class RecommendationHistory(BaseUUIDDocument):
    recommendation: Link[OptimizationRecommendation]
    action_taken: str
    accepted: bool
    implemented_at: Optional[datetime] = None
    verified_at: Optional[datetime] = None

    class Settings:
        name = "recommendation_history"
        indexes = [
            "accepted"
        ]
