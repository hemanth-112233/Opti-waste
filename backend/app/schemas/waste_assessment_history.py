from typing import Optional
from uuid import UUID
from datetime import datetime
from app.schemas.base import BaseSchema, BaseUUIDSchema
from app.schemas.cloud_resource import CloudResourceResponse

class WasteAssessmentHistoryBase(BaseSchema):
    previous_score: float
    current_score: float
    risk_level: str
    assessment_date: Optional[datetime] = None

class WasteAssessmentHistoryCreate(WasteAssessmentHistoryBase):
    resource_id: UUID

class WasteAssessmentHistoryUpdate(BaseSchema):
    previous_score: Optional[float] = None
    current_score: Optional[float] = None
    risk_level: Optional[str] = None

class WasteAssessmentHistoryResponse(WasteAssessmentHistoryBase, BaseUUIDSchema):
    resource: CloudResourceResponse
