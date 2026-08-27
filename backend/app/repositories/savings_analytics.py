from app.repositories.base import CRUDBase
from app.models.savings_analytics import SavingsAnalytics
from app.schemas.savings_analytics import SavingsAnalyticsCreate, SavingsAnalyticsUpdate

class RepositorySavingsAnalytics(CRUDBase[SavingsAnalytics, SavingsAnalyticsCreate, SavingsAnalyticsUpdate]):
    pass

savings_analytics = RepositorySavingsAnalytics(SavingsAnalytics)
