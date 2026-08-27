from typing import Optional
from app.schemas.base import BaseSchema, BaseUUIDSchema

class RoleBase(BaseSchema):
    name: str
    description: Optional[str] = None

class RoleCreate(RoleBase):
    pass

class RoleUpdate(BaseSchema):
    name: Optional[str] = None
    description: Optional[str] = None

class RoleResponse(RoleBase, BaseUUIDSchema):
    pass
