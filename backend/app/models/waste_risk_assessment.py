from datetime import datetime
from pydantic import Field
from beanie import Indexed, Link
from app.models.base import BaseUUIDDocument
from app.models.cloud_resource import CloudResource
from app.models.base import get_utc_now

class WasteRiskAssessment(BaseUUIDDocument):
    """Belongs to the CWRAF module"""
    resource: Link[CloudResource]
    risk_score: float = Field(..., description="Risk score from 0.0 to 100.0")
    risk_level: Indexed(str) = Field(..., description="Risk Level (e.g., HIGH, MEDIUM, LOW)")
    assessment_reason: str
    confidence_score: float = Field(..., description="Confidence from 0.0 to 1.0")
    assessment_timestamp: Indexed(datetime) = Field(default_factory=get_utc_now)

    class Settings:
        name = "waste_risk_assessments"
        indexes = [
            "risk_level",
            "assessment_timestamp"
        ]
