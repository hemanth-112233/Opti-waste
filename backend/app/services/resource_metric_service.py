from typing import List, Optional, Dict, Any
from uuid import UUID
from datetime import datetime, timezone
import logging

from app.models.resource_metric import ResourceMetric
from app.models.cloud_resource import CloudResource
from app.models.audit_log import AuditLog
from app.schemas.resource_metric import ResourceMetricCreate, ResourceMetricUpdate

logger = logging.getLogger(__name__)

class ResourceMetricService:

    @staticmethod
    async def create_metric(metric_in: ResourceMetricCreate, current_user_id: Optional[UUID] = None) -> ResourceMetric:
        # Validate values
        for val in [metric_in.cpu_utilization, metric_in.memory_utilization, metric_in.storage_utilization]:
            if val < 0 or val > 100:
                raise ValueError("Utilization metrics must be between 0 and 100.")

        resource = await CloudResource.get(metric_in.resource_id)
        if not resource:
            raise ValueError("Cloud Resource not found.")

        # Duplicate timestamp validation
        duplicate = await ResourceMetric.find_one(
            ResourceMetric.resource.id == resource.id,
            ResourceMetric.metric_timestamp == metric_in.metric_timestamp
        )
        if duplicate:
            raise ValueError("A metric entry for this timestamp already exists.")

        metric_dict = metric_in.model_dump(exclude={'resource_id'})
        metric = ResourceMetric(**metric_dict, resource=resource)
        await metric.insert()

        audit = AuditLog(
            user_id=current_user_id,
            action="Metric Created",
            module="Metrics",
            description=f"Created metric for resource {resource.resource_name}"
        )
        await audit.insert()
        return metric

    @staticmethod
    async def get_metrics(
        skip: int = 0, limit: int = 100, resource_id: Optional[UUID] = None
    ) -> List[ResourceMetric]:
        query = ResourceMetric.find()
        if resource_id:
            query = query.find({"resource.$id": resource_id})
        return await query.sort("-metric_timestamp").skip(skip).limit(limit).to_list(fetch_links=True)
        
    @staticmethod
    async def get_latest_metric(resource_id: UUID) -> Optional[ResourceMetric]:
        return await ResourceMetric.find({"resource.$id": resource_id}).sort("-metric_timestamp").first_or_none(fetch_links=True)

    @staticmethod
    async def get_metric(metric_id: UUID) -> Optional[ResourceMetric]:
        return await ResourceMetric.get(metric_id, fetch_links=True)

    @staticmethod
    async def update_metric(metric_id: UUID, update_in: ResourceMetricUpdate, current_user_id: Optional[UUID] = None) -> Optional[ResourceMetric]:
        metric = await ResourceMetric.get(metric_id, fetch_links=True)
        if not metric:
            return None
            
        update_data = update_in.model_dump(exclude_unset=True)
        # Re-validate
        util_keys = ['cpu_utilization', 'memory_utilization', 'storage_utilization']
        for k in util_keys:
            if k in update_data and (update_data[k] < 0 or update_data[k] > 100):
                 raise ValueError(f"{k} must be between 0 and 100.")

        for field, value in update_data.items():
            setattr(metric, field, value)
            
        metric.updated_at = datetime.now(timezone.utc)
        await metric.save()
        
        audit = AuditLog(
            user_id=current_user_id,
            action="Metric Updated",
            module="Metrics",
            description=f"Updated metric {metric_id}"
        )
        await audit.insert()
        return metric

    @staticmethod
    async def delete_metric(metric_id: UUID, current_user_id: Optional[UUID] = None) -> bool:
        metric = await ResourceMetric.get(metric_id)
        if not metric:
            return False
        await metric.delete()
        
        audit = AuditLog(
            user_id=current_user_id,
            action="Metric Deleted",
            module="Metrics",
            description=f"Deleted metric {metric_id}"
        )
        await audit.insert()
        return True

    @staticmethod
    async def get_dashboard_summary() -> Dict[str, Any]:
        pipeline = [
            {"$group": {
                "_id": None,
                "avg_cpu": {"$avg": "$cpu_utilization"},
                "avg_memory": {"$avg": "$memory_utilization"},
                "avg_storage": {"$avg": "$storage_utilization"},
                "avg_network_in": {"$avg": "$network_in"},
                "avg_network_out": {"$avg": "$network_out"}
            }}
        ]
        agg_result = await ResourceMetric.aggregate(pipeline).to_list()
        stats = agg_result[0] if agg_result else {
            "avg_cpu": 0, "avg_memory": 0, "avg_storage": 0, 
            "avg_network_in": 0, "avg_network_out": 0
        }
        
        running_cnt = await ResourceMetric.find({"instance_state": "running"}).count()
        stopped_cnt = await ResourceMetric.find({"instance_state": "stopped"}).count()
        
        return {
            "average_cpu_utilization": stats.get("avg_cpu", 0),
            "average_memory_utilization": stats.get("avg_memory", 0),
            "average_storage_utilization": stats.get("avg_storage", 0),
            "average_network_in": stats.get("avg_network_in", 0),
            "average_network_out": stats.get("avg_network_out", 0),
            "running_instances_metrics": running_cnt,
            "stopped_instances_metrics": stopped_cnt
        }
