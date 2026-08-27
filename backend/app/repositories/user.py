from typing import Optional
from app.repositories.base import CRUDBase
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate
from app.core.security import get_password_hash # type: ignore (Assuming a security module will be created)

class RepositoryUser(CRUDBase[User, UserCreate, UserUpdate]):
    async def get_by_email(self, email: str) -> Optional[User]:
        return await self.model.find_one(User.email == email, fetch_links=True)

    async def create(self, *, obj_in: UserCreate) -> User:
        db_obj = User(
            name=obj_in.name,
            email=obj_in.email,
            password_hash=get_password_hash(obj_in.password),
            role=obj_in.role_id, # Simplified, may need fetch logic
            is_active=obj_in.is_active
        )
        return await db_obj.insert()

user = RepositoryUser(User)
