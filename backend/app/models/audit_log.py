from datetime import datetime
from typing import Optional
from uuid import UUID
from pydantic import Field
from beanie import Indexed
from app.models.base import BaseUUIDDocument
from app.models.base import get_utc_now

class AuditLog(BaseUUIDDocument):
    user_id: Optional[UUID] = None
    action: str = Field(..., description="Action performed")
    module: Indexed(str) = Field(..., description="System module where action occurred")
    description: str
    ip_address: Optional[str] = None
    created_at: Indexed(datetime) = Field(default_factory=get_utc_now)

    class Settings:
        name = "audit_logs"
        indexes = [
            "module",
            "created_at"
        ]
