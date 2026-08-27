from app.repositories.base import CRUDBase
from app.models.waste_risk_assessment import WasteRiskAssessment
from app.schemas.waste_risk_assessment import WasteRiskAssessmentCreate, WasteRiskAssessmentUpdate

class RepositoryWasteRiskAssessment(CRUDBase[WasteRiskAssessment, WasteRiskAssessmentCreate, WasteRiskAssessmentUpdate]):
    pass

waste_risk_assessment = RepositoryWasteRiskAssessment(WasteRiskAssessment)
