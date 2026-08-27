import { CostRecord } from '../models/CostRecord';
import { CloudResource } from '../models/CloudResource';
import { CloudProvider } from '../models/CloudProvider';
import { AuditLog } from '../models/AuditLog';
import crypto from 'crypto';

export class CostService {
    static async createCostRecord(payload: any, userId: string = 'system') {
        const resource = await CloudResource.findOne({ _id: payload.resource_id, is_deleted: false });
        if (!resource) throw new Error('Cloud Resource not found or is deleted.');

        const provider = await CloudProvider.findOne({ _id: resource.provider_id, is_deleted: false });
        if (!provider) throw new Error('Cloud Provider not found or is deleted.');

        const duplicate = await CostRecord.findOne({
            resource_id: payload.resource_id,
            cost_timestamp: payload.cost_timestamp || new Date()
        });

        if (duplicate) throw new Error('A cost record for this resource and timestamp already exists.');

        const costData = {
            ...payload,
            _id: crypto.randomUUID(),
            provider_id: provider._id,
            cost_timestamp: payload.cost_timestamp || new Date()
        };

        const cost = await CostRecord.create(costData);

        await AuditLog.create({
            user_id: userId,
            action: 'CREATE',
            resource_type: 'CostRecord',
            description: `Logged Cost Record ${cost._id}`
        });

        return cost;
    }

    static async getCostRecords(skip: number = 0, limit: number = 100, resourceId?: string, providerId?: string) {
        const query: any = {};
        if (resourceId) query.resource_id = resourceId;
        if (providerId) query.provider_id = providerId;

        const data = await CostRecord.find(query)
            .sort('-cost_timestamp')
            .skip(skip)
            .limit(limit)
            .populate('resource_id', 'resource_name resource_type environment')
            .populate('provider_id', 'provider_name provider_type');

        const total = await CostRecord.countDocuments(query);
        return { data, total, skip, limit };
    }

    static async getCostRecord(id: string) {
        return CostRecord.findById(id).populate('resource_id').populate('provider_id');
    }

    static async updateCostRecord(id: string, payload: any, userId: string = 'system') {
        if (payload.daily_cost !== undefined && payload.daily_cost < 0) throw new Error('Cost cannot be negative.');

        const cost = await CostRecord.findByIdAndUpdate(
            id,
            { ...payload, updated_at: new Date() },
            { new: true }
        );

        if (cost) {
            await AuditLog.create({
                user_id: userId,
                action: 'UPDATE',
                resource_type: 'CostRecord',
                description: `Updated Cost Record ${id}`
            });
        }

        return cost;
    }

    static async deleteCostRecord(id: string, userId: string = 'system') {
        const cost = await CostRecord.findByIdAndDelete(id);
        if (cost) {
            await AuditLog.create({
                user_id: userId,
                action: 'DELETE',
                resource_type: 'CostRecord',
                description: `Deleted Cost Record ${id}`
            });
            return true;
        }
        return false;
    }

    static async getDashboardSummary() {
        // Aggregate global cost stats
        const pipeline = [{
            $group: {
                _id: null,
                total_daily: { $sum: '$daily_cost' },
                total_monthly: { $sum: '$monthly_cost' },
                total_yearly: { $sum: { $multiply: ['$monthly_cost', 12] } }, // Approximation if yearly is needed
                total_projected: { $sum: '$projected_monthly_cost' }
            }
        }];

        const statsResult = await CostRecord.aggregate(pipeline);
        const stats = statsResult[0] || { total_daily: 0, total_monthly: 0, total_yearly: 0, total_projected: 0 };

        // Provider wise distribution
        const providerPie = await CostRecord.aggregate([
            {
                $lookup: {
                    from: 'cloud_providers',
                    localField: 'provider_id',
                    foreignField: '_id',
                    as: 'providerDocs'
                }
            },
            { $unwind: { path: '$providerDocs', preserveNullAndEmptyArrays: true } },
            {
                $group: {
                    _id: '$providerDocs.provider_type',
                    total: { $sum: '$monthly_cost' }
                }
            }
        ]);

        const providerDistribution = providerPie.reduce((acc: any, curr: any) => {
            const name = curr._id || 'Unknown';
            acc[name] = (acc[name] || 0) + curr.total;
            return acc;
        }, {});

        // Top 10 most expensive resources
        const topResources = await CostRecord.aggregate([
            {
                $group: {
                    _id: '$resource_id',
                    cost: { $sum: '$monthly_cost' }
                }
            },
            { $sort: { cost: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'cloud_resources',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'resourceDocs'
                }
            },
            { $unwind: { path: '$resourceDocs', preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: 1,
                    resource_name: '$resourceDocs.resource_name',
                    provider_type: '$resourceDocs.provider_type',
                    total_cost: '$cost'
                }
            }
        ]);

        return {
            summary: {
                total_cloud_spend: stats.total_monthly,
                daily_spend: stats.total_daily,
                total_monthly_spend: stats.total_monthly,
                total_yearly_spend: stats.total_yearly,
                estimated_spend: stats.total_projected
            },
            provider_distribution: providerDistribution,
            top_expensive_resources: topResources
        };
    }

    static async getCostTrends(days: number = 30) {
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);

        const trends = await CostRecord.aggregate([
            { $match: { cost_timestamp: { $gte: cutoff } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$cost_timestamp" } },
                    total_daily: { $sum: '$daily_cost' }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        return trends.map((t: any) => ({
            date: t._id,
            cost: t.total_daily
        }));
    }
}
