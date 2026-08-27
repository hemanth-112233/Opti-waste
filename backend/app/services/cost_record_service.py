from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime, timezone
import logging

from app.models.cost_record import CostRecord
from app.models.cloud_resource import CloudResource
from app.models.cloud_provider import CloudProvider
from app.models.audit_log import AuditLog
from app.schemas.cost_record import CostRecordCreate, CostRecordUpdate

logger = logging.getLogger(__name__)

class CostRecordService:

    @staticmethod
    async def create_cost(cost_in: CostRecordCreate, current_user_id: Optional[UUID] = None) -> CostRecord:
        for val in [cost_in.daily_cost, cost_in.weekly_cost, cost_in.monthly_cost, cost_in.projected_monthly_cost]:
            if val < 0:
                raise ValueError("Costs must be positive values.")

        resource = await CloudResource.get(cost_in.resource_id)
        if not resource:
            raise ValueError("Cloud Resource not found.")

        provider = await CloudProvider.get(cost_in.provider_id)
        if not provider:
            raise ValueError("Cloud Provider not found.")

        cost_dict = cost_in.model_dump(exclude={'resource_id', 'provider_id'})
        cost = CostRecord(**cost_dict, resource=resource, provider=provider)
        await cost.insert()

        audit = AuditLog(
            user_id=current_user_id,
            action="Cost Created",
            module="Costs",
            description=f"Created cost record for resource {resource.resource_name}"
        )
        await audit.insert()
        return cost

    @staticmethod
    async def get_costs(
        skip: int = 0, limit: int = 100, resource_id: Optional[UUID] = None, provider_id: Optional[UUID] = None, billing_period: Optional[str] = None
    ) -> List[CostRecord]:
        query = CostRecord.find()
        if resource_id:
            query = query.find({"resource.$id": resource_id})
        if provider_id:
            query = query.find({"provider.$id": provider_id})
        if billing_period:
            query = query.find({"billing_period": billing_period})
            
        return await query.sort("-cost_timestamp").skip(skip).limit(limit).to_list(fetch_links=True)

    @staticmethod
    async def get_cost(cost_id: UUID) -> Optional[CostRecord]:
        return await CostRecord.get(cost_id, fetch_links=True)

    @staticmethod
    async def update_cost(cost_id: UUID, update_in: CostRecordUpdate, current_user_id: Optional[UUID] = None) -> Optional[CostRecord]:
        cost = await CostRecord.get(cost_id, fetch_links=True)
        if not cost:
            return None
            
        update_data = update_in.model_dump(exclude_unset=True)
        for k in ['daily_cost', 'weekly_cost', 'monthly_cost', 'projected_monthly_cost']:
            if k in update_data and update_data[k] < 0:
                 raise ValueError("Costs must be positive values.")

        for field, value in update_data.items():
            setattr(cost, field, value)
            
        cost.updated_at = datetime.now(timezone.utc)
        await cost.save()
        
        audit = AuditLog(
            user_id=current_user_id,
            action="Cost Updated",
            module="Costs",
            description=f"Updated cost {cost_id}"
        )
        await audit.insert()
        return cost

    @staticmethod
    async def delete_cost(cost_id: UUID, current_user_id: Optional[UUID] = None) -> bool:
        cost = await CostRecord.get(cost_id)
        if not cost:
            return False
        await cost.delete()
        
        audit = AuditLog(
            user_id=current_user_id,
            action="Cost Deleted",
            module="Costs",
            description=f"Deleted cost {cost_id}"
        )
        await audit.insert()
        return True

    @staticmethod
    async def get_dashboard_summary() -> Dict[str, Any]:
        pipeline = [
            {"$group": {
                "_id": None,
                "total_daily": {"$sum": "$daily_cost"},
                "total_monthly": {"$sum": "$monthly_cost"},
                "total_projected": {"$sum": "$projected_monthly_cost"},
                "avg_cost": {"$avg": "$monthly_cost"}
            }}
        ]
        agg_result = await CostRecord.aggregate(pipeline).to_list()
        stats = agg_result[0] if agg_result else {
            "total_daily": 0, "total_monthly": 0, "total_projected": 0, "avg_cost": 0
        }
        
        highest_costs = await CostRecord.find().sort("-monthly_cost").limit(5).to_list(fetch_links=True)
        
        # Provider grouping
        provider_agg = await CostRecord.aggregate([
            {"$group": {"_id": "$provider.$id", "provider_total": {"$sum": "$monthly_cost"}}}
        ]).to_list()
        
        # We can simulate region using highest_costs or do a manual join later since Beanie aggregate with lookup is complex. 
        # Using a simplified approach here based on resource reference.
        
        return {
            "total_daily_cost": stats.get("total_daily", 0),
            "total_monthly_cost": stats.get("total_monthly", 0),
            "projected_cost": stats.get("total_projected", 0),
            "average_resource_cost": stats.get("avg_cost", 0),
            "highest_cost_resources": [{"id": str(c.id), "monthly_cost": c.monthly_cost, "resource_name": c.resource.resource_name} for c in highest_costs],
            "cost_by_provider": provider_agg,
            "cost_by_region": [{"note": "Data requires resource join"}]
        }
