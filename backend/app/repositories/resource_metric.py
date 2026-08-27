from app.repositories.base import CRUDBase
from app.models.resource_metric import ResourceMetric
from app.schemas.resource_metric import ResourceMetricCreate, ResourceMetricUpdate

class RepositoryResourceMetric(CRUDBase[ResourceMetric, ResourceMetricCreate, ResourceMetricUpdate]):
    pass

resource_metric = RepositoryResourceMetric(ResourceMetric)
