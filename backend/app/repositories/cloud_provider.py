from app.repositories.base import CRUDBase
from app.models.cloud_provider import CloudProvider
from app.schemas.cloud_provider import CloudProviderCreate, CloudProviderUpdate

class RepositoryCloudProvider(CRUDBase[CloudProvider, CloudProviderCreate, CloudProviderUpdate]):
    pass

cloud_provider = RepositoryCloudProvider(CloudProvider)
