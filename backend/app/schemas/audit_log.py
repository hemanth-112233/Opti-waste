from typing import Optional
from uuid import UUID
from datetime import datetime
from app.schemas.base import BaseSchema, BaseUUIDSchema

class AuditLogBase(BaseSchema):
    user_id: Optional[UUID] = None
    action: str
    module: str
    description: str
    ip_address: Optional[str] = None
    created_at: Optional[datetime] = None

class AuditLogCreate(AuditLogBase):
    pass

class AuditLogUpdate(BaseSchema):
    pass # Normally audit logs are not updated, but standardizing the interface

class AuditLogResponse(AuditLogBase, BaseUUIDSchema):
    pass
