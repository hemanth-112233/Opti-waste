from pydantic import EmailStr, Field
from beanie import Indexed, Link
from app.models.base import TimestampedDocument
from app.models.role import Role

class User(TimestampedDocument):
    name: str
    email: Indexed(EmailStr, unique=True)
    password_hash: str
    role: Link[Role]
    is_active: bool = True

    class Settings:
        name = "users"
        indexes = [
            "email",
            "is_active"
        ]
