from app.repositories.base import CRUDBase
from app.models.recommendation_history import RecommendationHistory
from app.schemas.recommendation_history import RecommendationHistoryCreate, RecommendationHistoryUpdate

class RepositoryRecommendationHistory(CRUDBase[RecommendationHistory, RecommendationHistoryCreate, RecommendationHistoryUpdate]):
    pass

recommendation_history = RepositoryRecommendationHistory(RecommendationHistory)
