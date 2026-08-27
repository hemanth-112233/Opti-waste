from typing import Optional
from uuid import UUID
from pydantic import EmailStr
from app.schemas.base import BaseSchema, BaseUUIDSchema, TimestampSchema
from app.schemas.role import RoleResponse

class UserBase(BaseSchema):
    name: str
    email: EmailStr
    is_active: bool = True

class UserCreate(UserBase):
    password: str
    role_id: UUID

class UserUpdate(BaseSchema):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    role_id: Optional[UUID] = None
    is_active: Optional[bool] = None

class UserResponse(UserBase, BaseUUIDSchema, TimestampSchema):
    role: RoleResponse
