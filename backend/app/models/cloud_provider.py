from typing import Optional
from pydantic import Field
from beanie import Indexed
from app.models.base import TimestampedDocument

class CloudProvider(TimestampedDocument):
    provider_name: str
    provider_type: Indexed(str)  # AWS, Azure, GCP
    account_name: str
    account_id: str
    region: str
    status: str = "active"

    class Settings:
        name = "cloud_providers"
        indexes = [
            "provider_type",
            "provider_name"
        ]
