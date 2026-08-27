from app.repositories.base import CRUDBase
from app.models.cost_record import CostRecord
from app.schemas.cost_record import CostRecordCreate, CostRecordUpdate

class RepositoryCostRecord(CRUDBase[CostRecord, CostRecordCreate, CostRecordUpdate]):
    pass

cost_record = RepositoryCostRecord(CostRecord)
