from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime, timezone
import logging

from app.models.cloud_resource import CloudResource
from app.models.cloud_provider import CloudProvider
from app.models.audit_log import AuditLog
from app.schemas.cloud_resource import CloudResourceCreate, CloudResourceUpdate

logger = logging.getLogger(__name__)

class CloudResourceService:

    @staticmethod
    async def create_resource(resource_in: CloudResourceCreate, current_user_id: Optional[UUID] = None) -> CloudResource:
        # Validate Provider
        provider = await CloudProvider.get(resource_in.provider_id)
        if not provider:
            raise ValueError(f"Provider with ID {resource_in.provider_id} not found.")

        # Validate duplicate resource name in same provider
        duplicate = await CloudResource.find_one(
            CloudResource.provider.id == provider.id,
            CloudResource.resource_name == resource_in.resource_name
        )
        if duplicate:
            raise ValueError(f"Resource with name {resource_in.resource_name} already exists in this provider.")

        # Create
        resource_dict = resource_in.model_dump(exclude={'provider_id'})
        resource = CloudResource(**resource_dict, provider=provider) # Link field assigning
        await resource.insert()
        
        audit = AuditLog(
            user_id=current_user_id,
            action="Resource Created",
            module="Resources",
            description=f"Created Resource: {resource.resource_name}"
        )
        await audit.insert()
        return resource

    @staticmethod
    async def get_resources(
        skip: int = 0, 
        limit: int = 100, 
        search: Optional[str] = None,
        provider_id: Optional[UUID] = None,
        region: Optional[str] = None,
        environment: Optional[str] = None,
        status: Optional[str] = None,
        sort_by: str = "created_at",
        descending: bool = True
    ) -> List[CloudResource]:
        query = CloudResource.find()
        
        if search:
            query = query.find_many({"$or": [
                {"resource_name": {"$regex": search, "$options": "i"}},
                {"service_name": {"$regex": search, "$options": "i"}},
                {"owner": {"$regex": search, "$options": "i"}},
                {"project_name": {"$regex": search, "$options": "i"}}
            ]})
            
        if provider_id:
            query = query.find_many({"provider.$id": provider_id}) # Link query for specific UUID in Beanie might require this structure
        if region:
            query = query.find({"region": region})
        if environment:
            query = query.find({"environment": environment})
        if status:
            query = query.find({"status": status})
            
        sort_prefix = "-" if descending else "+"
        return await query.sort(f"{sort_prefix}{sort_by}").skip(skip).limit(limit).to_list(fetch_links=True)

    @staticmethod
    async def get_resource(resource_id: UUID) -> Optional[CloudResource]:
        return await CloudResource.get(resource_id, fetch_links=True)
        
    @staticmethod
    async def update_resource(resource_id: UUID, update_in: CloudResourceUpdate, current_user_id: Optional[UUID] = None) -> Optional[CloudResource]:
        resource = await CloudResource.get(resource_id)
        if not resource:
            return None
            
        update_data = update_in.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(resource, field, value)
            
        resource.updated_at = datetime.now(timezone.utc)
        await resource.save()
        
        audit = AuditLog(
            user_id=current_user_id,
            action="Resource Updated",
            module="Resources",
            description=f"Updated Resource: {resource.resource_name}"
        )
        await audit.insert()
        return resource

    @staticmethod
    async def delete_resource(resource_id: UUID, current_user_id: Optional[UUID] = None) -> bool:
        resource = await CloudResource.get(resource_id)
        if not resource:
            return False
            
        await resource.delete()
        
        audit = AuditLog(
            user_id=current_user_id,
            action="Resource Deleted",
            module="Resources",
            description=f"Deleted Resource: {resource.resource_name}"
        )
        await audit.insert()
        return True

    @staticmethod
    async def get_dashboard_summary() -> Dict[str, Any]:
        total_providers = await CloudProvider.count()
        total_resources = await CloudResource.count()
        
        running_resources = await CloudResource.find({"status": "running"}).count()
        stopped_resources = await CloudResource.find({"status": "stopped"}).count()
        production_resources = await CloudResource.find({"environment": "Production"}).count()
        development_resources = await CloudResource.find({"environment": "Development"}).count()

        # Aggregation for pie charts / metrics
        provider_agg = await CloudResource.aggregate([{"$group": {"_id": "$provider.$id", "count": {"$sum": 1}}}]).to_list()
        region_agg = await CloudResource.aggregate([{"$group": {"_id": "$region", "count": {"$sum": 1}}}]).to_list()
        service_agg = await CloudResource.aggregate([{"$group": {"_id": "$service_name", "count": {"$sum": 1}}}]).to_list()

        return {
            "total_providers": total_providers,
            "total_resources": total_resources,
            "running_resources": running_resources,
            "stopped_resources": stopped_resources,
            "production_resources": production_resources,
            "development_resources": development_resources,
            "resources_by_provider": provider_agg,
            "resources_by_region": region_agg,
            "resources_by_service": service_agg
        }
