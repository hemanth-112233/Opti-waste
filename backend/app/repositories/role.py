from typing import Optional
from app.repositories.base import CRUDBase
from app.models.role import Role
from app.schemas.role import RoleCreate, RoleUpdate

class RepositoryRole(CRUDBase[Role, RoleCreate, RoleUpdate]):
    async def get_by_name(self, name: str) -> Optional[Role]:
        return await self.model.find_one(Role.name == name)

role = RepositoryRole(Role)
