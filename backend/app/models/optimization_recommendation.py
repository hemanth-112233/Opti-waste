from datetime import datetime
from pydantic import Field
from beanie import Indexed, Link
from app.models.base import BaseUUIDDocument
from app.models.cloud_resource import CloudResource
from app.models.base import get_utc_now

class OptimizationRecommendation(BaseUUIDDocument):
    resource: Link[CloudResource]
    recommendation_title: str
    recommendation_description: str
    recommended_action: str
    predicted_savings: float
    estimated_impact: str
    priority: Indexed(str)
    status: Indexed(str) = "pending"
    generated_at: Indexed(datetime) = Field(default_factory=get_utc_now)

    class Settings:
        name = "optimization_recommendations"
        indexes = [
            "priority",
            "status",
            "generated_at"
        ]
