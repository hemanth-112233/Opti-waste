from uuid import UUID, uuid4
from datetime import datetime, timezone
from pydantic import Field
from beanie import Document

def get_utc_now() -> datetime:
    return datetime.now(timezone.utc)

class BaseUUIDDocument(Document):
    """
    Base Document that uses UUID for ID.
    Beanie defaults to PydanticObjectId, but we can override id type.
    """
    id: UUID = Field(default_factory=uuid4)

class TimestampedDocument(BaseUUIDDocument):
    """
    Base Document that includes created_at and updated_at.
    """
    created_at: datetime = Field(default_factory=get_utc_now)
    updated_at: datetime = Field(default_factory=get_utc_now)
