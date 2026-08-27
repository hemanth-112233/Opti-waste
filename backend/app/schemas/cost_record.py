from typing import Optional
from uuid import UUID
from datetime import datetime
from app.schemas.base import BaseSchema, BaseUUIDSchema, TimestampSchema
from app.schemas.cloud_resource import CloudResourceResponse
from app.schemas.cloud_provider import CloudProviderResponse

class CostRecordBase(BaseSchema):
    billing_period: str
    daily_cost: float = 0.0
    weekly_cost: float = 0.0
    monthly_cost: float = 0.0
    projected_monthly_cost: float = 0.0
    currency: str = "USD"
    billing_status: str = "pending"
    cost_timestamp: Optional[datetime] = None

class CostRecordCreate(CostRecordBase):
    resource_id: UUID
    provider_id: UUID

class CostRecordUpdate(BaseSchema):
    billing_period: Optional[str] = None
    daily_cost: Optional[float] = None
    weekly_cost: Optional[float] = None
    monthly_cost: Optional[float] = None
    projected_monthly_cost: Optional[float] = None
    currency: Optional[str] = None
    billing_status: Optional[str] = None
    cost_timestamp: Optional[datetime] = None

class CostRecordResponse(CostRecordBase, BaseUUIDSchema, TimestampSchema):
    resource: CloudResourceResponse
    provider: CloudProviderResponse
