import { CostRecord } from '../models/CostRecord';
import { CloudResource } from '../models/CloudResource';
import { CloudProvider } from '../models/CloudProvider';
import { AuditLog } from '../models/AuditLog';

export class CostRecordService {
    static async createCost(costData: any, currentUserId: string | null = null) {
        for (const val of [costData.daily_cost, costData.weekly_cost, costData.monthly_cost, costData.projected_monthly_cost]) {
            if (val < 0) throw new Error('Costs must be positive values.');
        }

        const resource = await CloudResource.findById(costData.resource_id);
        if (!resource) throw new Error('Cloud Resource not found.');

        const provider = await CloudProvider.findById(costData.provider_id);
        if (!provider) throw new Error('Cloud Provider not found.');

        const cost = new CostRecord({ ...costData, resource: resource._id, provider: provider._id });
        await cost.save();

        await AuditLog.create({
            user_id: currentUserId,
            action: 'Cost Created',
            resource_type: 'Costs',
            description: `Created cost record for resource ${resource.resource_name}`
        });
        return cost;
    }

    static async getCosts(skip: number = 0, limit: number = 100, resourceId?: string, providerId?: string, billingPeriod?: string) {
        let query: any = {};
        if (resourceId) query.resource = resourceId;
        if (providerId) query.provider = providerId;
        if (billingPeriod) query.billing_period = billingPeriod;

        return CostRecord.find(query).sort('-cost_timestamp').skip(skip).limit(limit).populate('resource provider');
    }

    static async getCost(costId: string) {
        return CostRecord.findById(costId).populate('resource provider');
    }

    static async updateCost(costId: string, updateData: any, currentUserId: string | null = null) {
        const cost = await CostRecord.findById(costId);
        if (!cost) return null;

        for (const k of ['daily_cost', 'weekly_cost', 'monthly_cost', 'projected_monthly_cost']) {
            if (k in updateData && updateData[k] < 0) throw new Error('Costs must be positive values.');
        }

        Object.assign(cost, updateData);
        cost.updated_at = new Date();
        await cost.save();

        await AuditLog.create({
            user_id: currentUserId,
            action: 'Cost Updated',
            resource_type: 'Costs',
            description: `Updated cost ${costId}`
        });

        return cost;
    }

    static async deleteCost(costId: string, currentUserId: string | null = null) {
        const cost = await CostRecord.findByIdAndDelete(costId);
        if (!cost) return false;

        await AuditLog.create({
            user_id: currentUserId,
            action: 'Cost Deleted',
            resource_type: 'Costs',
            description: `Deleted cost ${costId}`
        });

        return true;
    }

    static async getDashboardSummary() {
        const pipeline = [{
            $group: {
                _id: null,
                total_daily: { $sum: '$daily_cost' },
                total_monthly: { $sum: '$monthly_cost' },
                total_projected: { $sum: '$projected_monthly_cost' },
                avg_cost: { $avg: '$monthly_cost' }
            }
        }];

        const agg_result = await CostRecord.aggregate(pipeline);
        const stats = agg_result.length ? agg_result[0] : { total_daily: 0, total_monthly: 0, total_projected: 0, avg_cost: 0 };

        const highest_costs = await CostRecord.find().sort('-monthly_cost').limit(5).populate('resource');

        const provider_agg = await CostRecord.aggregate([
            { $group: { _id: '$provider', provider_total: { $sum: '$monthly_cost' } } }
        ]);

        return {
            total_daily_cost: stats.total_daily || 0,
            total_monthly_cost: stats.total_monthly || 0,
            projected_cost: stats.total_projected || 0,
            average_resource_cost: stats.avg_cost || 0,
            highest_cost_resources: highest_costs.map((c: any) => ({
                id: c._id.toString(),
                monthly_cost: c.monthly_cost,
                resource_name: c.resource?.resource_name || 'Unknown'
            })),
            cost_by_provider: provider_agg,
            cost_by_region: [{ note: 'Data requires resource join' }]
        };
    }
}
