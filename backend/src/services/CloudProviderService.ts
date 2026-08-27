import { CloudProvider, ICloudProvider } from '../models/CloudProvider';
import { AuditLog } from '../models/AuditLog';
import { encryptCredentials } from '../utils/encryption';

export class CloudProviderService {
    static async createProvider(providerData: Partial<ICloudProvider>, currentUserId: string | null = null) {
        if (providerData.account_id) {
            const exists = await CloudProvider.findOne({ account_id: providerData.account_id, is_deleted: false });
            if (exists) {
                throw new Error('Duplicate account ID');
            }
        }

        if (providerData.credentials) {
            const enc = encryptCredentials(providerData.credentials);
            providerData.credentials = enc.credentials;
            providerData.credentials_iv = enc.credentials_iv;
            providerData.auth_tag = enc.auth_tag;
        }

        const provider = new CloudProvider(providerData);
        await provider.save();

        await AuditLog.create({
            user_id: currentUserId,
            action: 'Provider Created',
            resource_type: 'Providers',
            description: `Created Cloud Provider: ${provider.provider_name} (${provider.provider_type})`
        });

        return provider;
    }

    static async getProviders(skip: number = 0, limit: number = 100, search?: string, status?: string, sort?: string) {
        const query: any = { is_deleted: false };

        if (search) {
            query.$or = [
                { provider_name: { $regex: search, $options: 'i' } },
                { account_name: { $regex: search, $options: 'i' } },
                { account_id: { $regex: search, $options: 'i' } }
            ];
        }
        if (status) {
            query.status = status;
        }

        let sortOption: any = { created_at: -1 };
        if (sort === 'provider_name') sortOption = { provider_name: 1 };
        if (sort === 'status') sortOption = { status: 1 };

        const total = await CloudProvider.countDocuments(query);
        const data = await CloudProvider.find(query).sort(sortOption).skip(skip).limit(limit);

        return { data, total, skip, limit };
    }

    static async getProvider(providerId: string) {
        return CloudProvider.findOne({ _id: providerId, is_deleted: false });
    }

    static async updateProvider(providerId: string, updateData: Partial<ICloudProvider>, currentUserId: string | null = null) {
        const provider = await CloudProvider.findOne({ _id: providerId, is_deleted: false });
        if (!provider) return null;

        if (updateData.account_id && updateData.account_id !== provider.account_id) {
            const exists = await CloudProvider.findOne({ account_id: updateData.account_id, is_deleted: false });
            if (exists) {
                throw new Error('Duplicate account ID');
            }
        }

        if (updateData.credentials) {
            const enc = encryptCredentials(updateData.credentials);
            updateData.credentials = enc.credentials;
            updateData.credentials_iv = enc.credentials_iv;
            updateData.auth_tag = enc.auth_tag;
        }

        Object.assign(provider, updateData);
        provider.updated_at = new Date();
        await provider.save();

        await AuditLog.create({
            user_id: currentUserId,
            action: 'Provider Updated',
            resource_type: 'Providers',
            description: `Updated Cloud Provider: ${provider.provider_name}`
        });

        return provider;
    }

    static async setProviderStatus(providerId: string, status: 'active' | 'inactive', currentUserId: string | null = null) {
        const provider = await CloudProvider.findOneAndUpdate(
            { _id: providerId, is_deleted: false },
            { status, updated_at: new Date() },
            { new: true }
        );
        if (!provider) return null;

        await AuditLog.create({
            user_id: currentUserId,
            action: `Provider ${status === 'active' ? 'Activated' : 'Deactivated'}`,
            resource_type: 'Providers',
            description: `${status === 'active' ? 'Activated' : 'Deactivated'} Provider: ${provider.provider_name}`
        });
        return provider;
    }

    static async deleteProvider(providerId: string, currentUserId: string | null = null) {
        const provider = await CloudProvider.findOneAndUpdate(
            { _id: providerId, is_deleted: false },
            { is_deleted: true, status: 'deleted', updated_at: new Date() }
        );
        if (!provider) return false;

        await AuditLog.create({
            user_id: currentUserId,
            action: 'Provider Deleted',
            resource_type: 'Providers',
            description: `Soft-Deleted Cloud Provider: ${provider.provider_name}`
        });

        return true;
    }
}
