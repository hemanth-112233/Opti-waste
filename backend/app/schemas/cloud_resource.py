from typing import Optional, Dict, Any
from uuid import UUID
from app.schemas.base import BaseSchema, BaseUUIDSchema, TimestampSchema
from app.schemas.cloud_provider import CloudProviderResponse

class CloudResourceBase(BaseSchema):
    resource_name: str
    resource_type: str
    instance_type: Optional[str] = None
    service_name: str
    region: str
    availability_zone: Optional[str] = None
    status: str
    owner: Optional[str] = None
    project_name: Optional[str] = None
    environment: str = "Development"
    monthly_cost: float = 0.0
    tags: Dict[str, Any] = {}

class CloudResourceCreate(CloudResourceBase):
    provider_id: UUID

class CloudResourceUpdate(BaseSchema):
    resource_name: Optional[str] = None
    resource_type: Optional[str] = None
    instance_type: Optional[str] = None
    service_name: Optional[str] = None
    region: Optional[str] = None
    availability_zone: Optional[str] = None
    status: Optional[str] = None
    owner: Optional[str] = None
    project_name: Optional[str] = None
    environment: Optional[str] = None
    monthly_cost: Optional[float] = None
    tags: Optional[Dict[str, Any]] = None

class CloudResourceResponse(CloudResourceBase, BaseUUIDSchema, TimestampSchema):
    provider: CloudProviderResponse
