from app.repositories.base import CRUDBase
from app.models.closed_loop_feedback import ClosedLoopFeedback
from app.schemas.closed_loop_feedback import ClosedLoopFeedbackCreate, ClosedLoopFeedbackUpdate

class RepositoryClosedLoopFeedback(CRUDBase[ClosedLoopFeedback, ClosedLoopFeedbackCreate, ClosedLoopFeedbackUpdate]):
    pass

closed_loop_feedback = RepositoryClosedLoopFeedback(ClosedLoopFeedback)
