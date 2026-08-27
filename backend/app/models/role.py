from pydantic import Field
from beanie import Indexed
from app.models.base import BaseUUIDDocument

class Role(BaseUUIDDocument):
    name: str = Field(..., description="Name of the role")
    description: str | None = Field(None, description="Detailed description")

    class Settings:
        name = "roles"
        indexes = [
            "name"
        ]
