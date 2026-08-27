import uuid
from datetime import datetime, timezone
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.ext.declarative import declared_attr
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy import DateTime

class Base(DeclarativeBase):
    __name__: str
    
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Generate __tablename__ automatically from class name
    @declared_attr
    def __tablename__(cls) -> str:
        return cls.__name__.lower()

class TimestampMixin:
    """Mixin to add timezone-aware created_at and updated_at columns."""
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
