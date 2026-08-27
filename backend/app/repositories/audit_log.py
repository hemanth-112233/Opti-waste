from app.repositories.base import CRUDBase
from app.models.audit_log import AuditLog
from app.schemas.audit_log import AuditLogCreate, AuditLogUpdate

class RepositoryAuditLog(CRUDBase[AuditLog, AuditLogCreate, AuditLogUpdate]):
    pass

audit_log = RepositoryAuditLog(AuditLog)
