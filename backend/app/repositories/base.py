from typing import Any, Dict, Generic, List, Optional, Type, TypeVar, Union
from uuid import UUID
from beanie import Document
from pydantic import BaseModel

ModelType = TypeVar("ModelType", bound=Document)
CreateSchemaType = TypeVar("CreateSchemaType", bound=BaseModel)
UpdateSchemaType = TypeVar("UpdateSchemaType", bound=BaseModel)

class CRUDBase(Generic[ModelType, CreateSchemaType, UpdateSchemaType]):
    def __init__(self, model: Type[ModelType]):
        """
        CRUD object with default methods to Create, Read, Update, Delete (CRUD).
        """
        self.model = model

    async def get(self, id: UUID) -> Optional[ModelType]:
        return await self.model.get(id, fetch_links=True)

    async def get_multi(
        self, *, skip: int = 0, limit: int = 100
    ) -> List[ModelType]:
        return await self.model.find_all(fetch_links=True).skip(skip).limit(limit).to_list()

    async def create(self, *, obj_in: CreateSchemaType) -> ModelType:
        obj_in_data = obj_in.model_dump()
        db_obj = self.model(**obj_in_data)
        return await db_obj.insert()

    async def update(
        self,
        *,
        db_obj: ModelType,
        obj_in: Union[UpdateSchemaType, Dict[str, Any]]
    ) -> ModelType:
        if isinstance(obj_in, dict):
            update_data = obj_in
        else:
            update_data = obj_in.model_dump(exclude_unset=True)
            
        for field, value in update_data.items():
            if hasattr(db_obj, field):
                setattr(db_obj, field, value)
                
        return await db_obj.save()

    async def remove(self, *, id: UUID) -> ModelType:
        obj = await self.model.get(id)
        if obj:
            await obj.delete()
        return obj
