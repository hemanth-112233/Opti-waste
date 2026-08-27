from datetime import datetime
from pydantic import Field
from beanie import Indexed, Link
from app.models.base import TimestampedDocument
from app.models.cloud_resource import CloudResource
from app.models.base import get_utc_now

class ResourceMetric(TimestampedDocument):
    resource: Link[CloudResource]
    cpu_utilization: float = Field(0.0, description="Percentage of CPU utilized")
    memory_utilization: float = Field(0.0, description="Percentage of memory utilized")
    storage_utilization: float = Field(0.0, description="Percentage of storage utilized")
    network_in: float = Field(0.0, description="Network incoming usage in MB")
    network_out: float = Field(0.0, description="Network outgoing usage in MB")
    disk_read: float = Field(0.0, description="Disk read operations/usage")
    disk_write: float = Field(0.0, description="Disk write operations/usage")
    uptime_hours: float = Field(0.0, description="Uptime in hours")
    instance_state: Indexed(str) = "running"
    metric_timestamp: Indexed(datetime) = Field(default_factory=get_utc_now)

    class Settings:
        name = "resource_metrics"
        indexes = [
            "metric_timestamp",
            "instance_state"
        ]
