from datetime import datetime
from pydantic import Field
from beanie import Indexed, Link
from app.models.base import BaseUUIDDocument
from app.models.cloud_resource import CloudResource
from app.models.base import get_utc_now

class WasteAssessmentHistory(BaseUUIDDocument):
    resource: Link[CloudResource]
    previous_score: float
    current_score: float
    risk_level: Indexed(str)
    assessment_date: Indexed(datetime) = Field(default_factory=get_utc_now)

    class Settings:
        name = "waste_assessment_history"
        indexes = [
            "assessment_date",
            "risk_level"
        ]
