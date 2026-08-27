from typing import Optional
from uuid import UUID
from datetime import datetime
from app.schemas.base import BaseSchema, BaseUUIDSchema, TimestampSchema
from app.schemas.cloud_resource import CloudResourceResponse

class ResourceMetricBase(BaseSchema):
    cpu_utilization: float = 0.0
    memory_utilization: float = 0.0
    storage_utilization: float = 0.0
    network_in: float = 0.0
    network_out: float = 0.0
    disk_read: float = 0.0
    disk_write: float = 0.0
    uptime_hours: float = 0.0
    instance_state: str = "running"
    metric_timestamp: Optional[datetime] = None

class ResourceMetricCreate(ResourceMetricBase):
    resource_id: UUID

class ResourceMetricUpdate(BaseSchema):
    cpu_utilization: Optional[float] = None
    memory_utilization: Optional[float] = None
    storage_utilization: Optional[float] = None
    network_in: Optional[float] = None
    network_out: Optional[float] = None
    disk_read: Optional[float] = None
    disk_write: Optional[float] = None
    uptime_hours: Optional[float] = None
    instance_state: Optional[str] = None
    metric_timestamp: Optional[datetime] = None

class ResourceMetricResponse(ResourceMetricBase, BaseUUIDSchema, TimestampSchema):
    resource: CloudResourceResponse
