import { ResourceMetric } from '../models/ResourceMetric';
import { CloudResource } from '../models/CloudResource';
import { AuditLog } from '../models/AuditLog';
import crypto from 'crypto';

export class ResourceMetricService {
    static async createMetric(metricData: any, currentUserId: string = 'system') {
        for (const val of [metricData.cpu_utilization, metricData.memory_utilization, metricData.storage_utilization]) {
            if (val < 0 || val > 100) throw new Error('Utilization metrics must be between 0 and 100.');
        }

        const resource = await CloudResource.findOne({ _id: metricData.resource_id, is_deleted: false });
        if (!resource) throw new Error('Cloud Resource not found or is deleted.');

        const duplicate = await ResourceMetric.findOne({
            resource_id: resource._id,
            metric_timestamp: metricData.metric_timestamp
        });
        if (duplicate) throw new Error('A metric entry for this timestamp already exists.');

        const metric = new ResourceMetric({ ...metricData, resource_id: resource._id, _id: crypto.randomUUID() });
        await metric.save();

        await AuditLog.create({
            user_id: currentUserId,
            action: 'CREATE',
            resource_type: 'ResourceMetric',
            description: `Metric logged for ${resource.resource_name} mapped under ${metric._id}`
        });

        return metric;
    }

    static async getMetrics(skip: number = 0, limit: number = 100, resourceId?: string) {
        let query: any = {};
        if (resourceId) query.resource_id = resourceId;

        const data = await ResourceMetric.find(query).sort('-metric_timestamp').skip(skip).limit(limit).populate('resource_id');
        const total = await ResourceMetric.countDocuments(query);

        return { data, total, skip, limit };
    }

    static async getLatestMetric(resourceId: string) {
        return ResourceMetric.findOne({ resource_id: resourceId }).sort('-metric_timestamp').populate('resource_id');
    }

    static async getMetric(metricId: string) {
        return ResourceMetric.findById(metricId).populate('resource_id');
    }

    static async updateMetric(metricId: string, updateData: any, currentUserId: string = 'system') {
        const metric = await ResourceMetric.findById(metricId);
        if (!metric) return null;

        for (const k of ['cpu_utilization', 'memory_utilization', 'storage_utilization']) {
            if (k in updateData && (updateData[k] < 0 || updateData[k] > 100)) throw new Error(`${k} must be between 0 and 100.`);
        }

        Object.assign(metric, updateData);
        metric.updated_at = new Date();
        await metric.save();

        await AuditLog.create({
            user_id: currentUserId,
            action: 'UPDATE',
            resource_type: 'ResourceMetric',
            description: `Updates committed downstream on metric trace ${metricId}`
        });

        return metric;
    }

    static async deleteMetric(metricId: string, currentUserId: string = 'system') {
        const metric = await ResourceMetric.findByIdAndDelete(metricId);
        if (!metric) return false;

        await AuditLog.create({
            user_id: currentUserId,
            action: 'DELETE',
            resource_type: 'ResourceMetric',
            description: `Hard deleted internal trace ${metricId}`
        });
        return true;
    }

    static async getDashboardSummary() {
        const pipeline = [{
            $group: {
                _id: null,
                avg_cpu: { $avg: '$cpu_utilization' },
                avg_memory: { $avg: '$memory_utilization' },
                avg_storage: { $avg: '$storage_utilization' },
                avg_network_in: { $avg: '$network_in' },
                avg_network_out: { $avg: '$network_out' },
                total_records: { $sum: 1 }
            }
        }];

        const agg_result = await ResourceMetric.aggregate(pipeline);
        const stats = agg_result.length ? agg_result[0] : {
            avg_cpu: 0, avg_memory: 0, avg_storage: 0, avg_network_in: 0, avg_network_out: 0, total_records: 0
        };

        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 7);
        const active_metrics = await ResourceMetric.countDocuments({ metric_timestamp: { $gte: cutoff } });

        return {
            average_cpu_utilization: stats.avg_cpu || 0,
            average_memory_utilization: stats.avg_memory || 0,
            average_storage_utilization: stats.avg_storage || 0,
            average_network_in: stats.avg_network_in || 0,
            average_network_out: stats.avg_network_out || 0,
            total_historical_metrics: stats.total_records,
            active_metrics_last_7_days: active_metrics
        };
    }
}
