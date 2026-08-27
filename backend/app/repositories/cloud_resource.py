from typing import List
from uuid import UUID
from app.repositories.base import CRUDBase
from app.models.cloud_resource import CloudResource
from app.schemas.cloud_resource import CloudResourceCreate, CloudResourceUpdate

class RepositoryCloudResource(CRUDBase[CloudResource, CloudResourceCreate, CloudResourceUpdate]):
    async def get_by_provider(self, provider_id: UUID) -> List[CloudResource]:
        return await self.model.find(CloudResource.provider.id == provider_id, fetch_links=True).to_list()

cloud_resource = RepositoryCloudResource(CloudResource)
