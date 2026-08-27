from app.repositories.role import role
from app.repositories.user import user
from app.repositories.cloud_provider import cloud_provider
from app.repositories.cloud_resource import cloud_resource
from app.repositories.resource_metric import resource_metric
from app.repositories.cost_record import cost_record
from app.repositories.waste_risk_assessment import waste_risk_assessment
from app.repositories.optimization_recommendation import optimization_recommendation
from app.repositories.recommendation_verification import recommendation_verification
from app.repositories.recommendation_history import recommendation_history
from app.repositories.closed_loop_feedback import closed_loop_feedback
from app.repositories.waste_assessment_history import waste_assessment_history
from app.repositories.savings_analytics import savings_analytics
from app.repositories.audit_log import audit_log

__all__ = [
    "role",
    "user",
    "cloud_provider",
    "cloud_resource",
    "resource_metric",
    "cost_record",
    "waste_risk_assessment",
    "optimization_recommendation",
    "recommendation_verification",
    "recommendation_history",
    "closed_loop_feedback",
    "waste_assessment_history",
    "savings_analytics",
    "audit_log",
]
