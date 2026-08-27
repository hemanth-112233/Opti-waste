from typing import Dict, Any, Optional
from pydantic import Field
from beanie import Indexed, Link
from app.models.base import TimestampedDocument
from app.models.cloud_provider import CloudProvider

class CloudResource(TimestampedDocument):
    provider: Link[CloudProvider]
    resource_name: str
    resource_type: Indexed(str)
    instance_type: Optional[str] = None
    service_name: Indexed(str)
    region: str
    availability_zone: Optional[str] = None
    status: str
    owner: Optional[str] = None
    project_name: Optional[str] = None
    environment: Indexed(str) = "Development"
    monthly_cost: float = 0.0
    tags: Dict[str, Any] = Field(default_factory=dict)

    class Settings:
        name = "cloud_resources"
        indexes = [
            "resource_type",
            "service_name",
            "status",
            "region",
            "environment"
        ]
