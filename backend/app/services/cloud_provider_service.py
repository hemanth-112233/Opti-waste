from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone
import logging

from app.models.cloud_provider import CloudProvider
from app.models.audit_log import AuditLog
from app.schemas.cloud_provider import CloudProviderCreate, CloudProviderUpdate
from beanie import PydanticObjectId
# Assuming HTTPException or generic App exception can be used. Will use ValueError/KeyError or FastAPI HTTPException depending on router.
# Let's keep services returning objects or raising ValueError that routers catch.

logger = logging.getLogger(__name__)

class CloudProviderService:
    
    @staticmethod
    async def create_provider(provider_in: CloudProviderCreate, current_user_id: Optional[UUID] = None) -> CloudProvider:
        # Create provider
        provider = CloudProvider(**provider_in.model_dump())
        await provider.insert()

        # Audit Log
        audit = AuditLog(
            user_id=current_user_id,
            action="Provider Created",
            module="Providers",
            description=f"Created Cloud Provider: {provider.provider_name} ({provider.provider_type})"
        )
        await audit.insert()
        return provider

    @staticmethod
    async def get_providers(skip: int = 0, limit: int = 100) -> List[CloudProvider]:
        return await CloudProvider.find_all().skip(skip).limit(limit).to_list()

    @staticmethod
    async def get_provider(provider_id: UUID) -> Optional[CloudProvider]:
        return await CloudProvider.get(provider_id)
        
    @staticmethod
    async def update_provider(provider_id: UUID, update_in: CloudProviderUpdate, current_user_id: Optional[UUID] = None) -> Optional[CloudProvider]:
        provider = await CloudProvider.get(provider_id)
        if not provider:
            return None
            
        update_data = update_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(provider, field, value)
            
        provider.updated_at = datetime.now(timezone.utc)
        await provider.save()
        
        audit = AuditLog(
            user_id=current_user_id,
            action="Provider Updated",
            module="Providers",
            description=f"Updated Cloud Provider: {provider.provider_name}"
        )
        await audit.insert()
        return provider

    @staticmethod
    async def delete_provider(provider_id: UUID, current_user_id: Optional[UUID] = None) -> bool:
        provider = await CloudProvider.get(provider_id)
        if not provider:
            return False
            
        await provider.delete()
        
        audit = AuditLog(
            user_id=current_user_id,
            action="Provider Deleted",
            module="Providers",
            description=f"Deleted Cloud Provider: {provider.provider_name}"
        )
        await audit.insert()
        return True
