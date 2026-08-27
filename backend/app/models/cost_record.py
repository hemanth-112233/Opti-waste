from datetime import datetime
from pydantic import Field
from beanie import Indexed, Link
from app.models.base import TimestampedDocument
from app.models.cloud_resource import CloudResource
from app.models.cloud_provider import CloudProvider
from app.models.base import get_utc_now

class CostRecord(TimestampedDocument):
    resource: Link[CloudResource]
    provider: Link[CloudProvider]
    billing_period: Indexed(str)
    daily_cost: float = Field(0.0, description="Daily cost in currency")
    weekly_cost: float = Field(0.0, description="Weekly cost in currency")
    monthly_cost: float = Field(0.0, description="Monthly cost in currency")
    projected_monthly_cost: float = Field(0.0, description="Projected monthly cost")
    currency: str = "USD"
    billing_status: Indexed(str) = "pending"
    cost_timestamp: Indexed(datetime) = Field(default_factory=get_utc_now)

    class Settings:
        name = "cost_records"
        indexes = [
            "billing_period",
            "currency",
            "billing_status",
            "cost_timestamp"
        ]
