from typing import Optional
from uuid import UUID
from datetime import datetime
from app.schemas.base import BaseSchema, BaseUUIDSchema
from app.schemas.cloud_resource import CloudResourceResponse

class WasteRiskAssessmentBase(BaseSchema):
    risk_score: float
    risk_level: str
    assessment_reason: str
    confidence_score: float
    assessment_timestamp: Optional[datetime] = None

class WasteRiskAssessmentCreate(WasteRiskAssessmentBase):
    resource_id: UUID

class WasteRiskAssessmentUpdate(BaseSchema):
    risk_score: Optional[float] = None
    risk_level: Optional[str] = None
    assessment_reason: Optional[str] = None
    confidence_score: Optional[float] = None

class WasteRiskAssessmentResponse(WasteRiskAssessmentBase, BaseUUIDSchema):
    resource: CloudResourceResponse
