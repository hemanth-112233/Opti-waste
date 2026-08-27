from datetime import datetime
from pydantic import Field
from beanie import Indexed, Link
from app.models.base import BaseUUIDDocument
from app.models.cloud_resource import CloudResource
from app.models.base import get_utc_now

class SavingsAnalytics(BaseUUIDDocument):
    resource: Link[CloudResource]
    predicted_savings: float
    actual_savings: float
    percentage_saved: float
    calculation_date: Indexed(datetime) = Field(default_factory=get_utc_now)

    class Settings:
        name = "savings_analytics"
        indexes = [
            "calculation_date"
        ]
