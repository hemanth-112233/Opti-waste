from typing import Optional
from uuid import UUID
from datetime import datetime
from app.schemas.base import BaseSchema, BaseUUIDSchema
from app.schemas.cloud_resource import CloudResourceResponse

class SavingsAnalyticsBase(BaseSchema):
    predicted_savings: float
    actual_savings: float
    percentage_saved: float
    calculation_date: Optional[datetime] = None

class SavingsAnalyticsCreate(SavingsAnalyticsBase):
    resource_id: UUID

class SavingsAnalyticsUpdate(BaseSchema):
    predicted_savings: Optional[float] = None
    actual_savings: Optional[float] = None
    percentage_saved: Optional[float] = None

class SavingsAnalyticsResponse(SavingsAnalyticsBase, BaseUUIDSchema):
    resource: CloudResourceResponse
