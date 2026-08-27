from typing import Optional
from app.schemas.base import BaseSchema, BaseUUIDSchema, TimestampSchema

class CloudProviderBase(BaseSchema):
    provider_name: str
    provider_type: str
    account_name: str
    account_id: str
    region: str
    status: str = "active"

class CloudProviderCreate(CloudProviderBase):
    pass

class CloudProviderUpdate(BaseSchema):
    provider_name: Optional[str] = None
    provider_type: Optional[str] = None
    account_name: Optional[str] = None
    account_id: Optional[str] = None
    region: Optional[str] = None
    status: Optional[str] = None

class CloudProviderResponse(CloudProviderBase, BaseUUIDSchema, TimestampSchema):
    pass
