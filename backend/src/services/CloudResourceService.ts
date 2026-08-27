import { CloudResource, ICloudResource } from '../models/CloudResource';
import { CloudProvider } from '../models/CloudProvider';
import { AuditLog } from '../models/AuditLog';

export class CloudResourceService {
    static async createResource(resourceData: Partial<ICloudResource>, currentUserId: string | null = null) {
        const provider = await CloudProvider.findOne({ _id: resourceData.provider_id, is_deleted: false });
        if (!provider) {
            throw new Error(`Invalid provider: Cloud Provider ${resourceData.provider_id} not found or has been deleted.`);
        }

        // Auto-populate provider type to prevent drifting
        resourceData.provider_type = provider.provider_type;

        const duplicate = await CloudResource.findOne({
            provider_id: provider._id,
            resource_name: resourceData.resource_name,
            is_deleted: false
        });
        if (duplicate) {
            throw new Error(`Duplicate Resource: ${resourceData.resource_name} already exists under this provider.`);
        }

        const resource = new CloudResource(resourceData);
        await resource.save();

        await AuditLog.create({
            user_id: currentUserId,
            action: 'Resource Created',
            resource_type: 'Resources',
            description: `Provisioned Cloud Resource: ${resource.resource_name} via ${provider.provider_name}`
        });

        return resource;
    }

    static async getResources(
        skip: number = 0, limit: number = 100, search?: string, provider_id?: string, status?: string, sort?: string
    ) {
        const query: any = { is_deleted: false };

        if (search) {
            query.$or = [
                { resource_name: { $regex: search, $options: 'i' } },
                { service_name: { $regex: search, $options: 'i' } },
                { owner: { $regex: search, $options: 'i' } },
                { project_name: { $regex: search, $options: 'i' } }
            ];
        }

        if (provider_id) query.provider_id = provider_id;
        if (status) query.status = status;

        let sortOption: any = { created_at: -1 };
        if (sort === 'resource_name') sortOption = { resource_name: 1 };
        if (sort === 'status') sortOption = { status: 1 };
        if (sort === 'monthly_cost') sortOption = { monthly_cost: -1 };

        const total = await CloudResource.countDocuments(query);
        const data = await CloudResource.find(query).sort(sortOption).skip(skip).limit(limit).populate('provider_id', 'provider_name provider_type status');

        return { data, total, skip, limit };
    }

    static async getResource(resourceId: string) {
        return CloudResource.findOne({ _id: resourceId, is_deleted: false }).populate('provider_id');
    }

    static async updateResource(resourceId: string, updateData: Partial<ICloudResource>, currentUserId: string | null = null) {
        const resource = await CloudResource.findOne({ _id: resourceId, is_deleted: false });
        if (!resource) return null;

        if (updateData.provider_id && updateData.provider_id !== resource.provider_id) {
            const provider = await CloudProvider.findOne({ _id: updateData.provider_id, is_deleted: false });
            if (!provider) throw new Error(`Invalid provider: new Cloud Provider ${updateData.provider_id} not found.`);
            updateData.provider_type = provider.provider_type;
        }

        Object.assign(resource, updateData);
        resource.updated_at = new Date();
        await resource.save();

        await AuditLog.create({
            user_id: currentUserId,
            action: 'Resource Updated',
            resource_type: 'Resources',
            description: `Updated Resource Configuration: ${resource.resource_name}`
        });

        return resource;
    }

    static async deleteResource(resourceId: string, currentUserId: string | null = null) {
        const resource = await CloudResource.findOneAndUpdate(
            { _id: resourceId, is_deleted: false },
            { is_deleted: true, status: 'terminated', updated_at: new Date() }
        );
        if (!resource) return false;

        await AuditLog.create({
            user_id: currentUserId,
            action: 'Resource Deleted',
            resource_type: 'Resources',
            description: `Soft-Deleted Resource: ${resource.resource_name}`
        });

        return true;
    }

    static async getDashboardSummary() {
        const query = { is_deleted: false };

        const total_resources = await CloudResource.countDocuments(query);
        const running_resources = await CloudResource.countDocuments({ ...query, status: 'running' });
        const stopped_resources = await CloudResource.countDocuments({ ...query, status: 'stopped' });
        const terminated_resources = await CloudResource.countDocuments({ ...query, status: 'terminated' });

        const aws_resources = await CloudResource.countDocuments({ ...query, provider_type: 'AWS' });
        const azure_resources = await CloudResource.countDocuments({ ...query, provider_type: 'Azure' });
        const gcp_resources = await CloudResource.countDocuments({ ...query, provider_type: 'GCP' });

        return {
            total_resources,
            running_resources,
            stopped_resources,
            terminated_resources,
            aws_resources,
            azure_resources,
            gcp_resources
        };
    }
}
