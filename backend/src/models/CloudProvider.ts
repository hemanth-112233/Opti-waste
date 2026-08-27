import mongoose, { Schema, Document } from 'mongoose';
import { BaseModelPlugin } from './BaseModelPlugin';
import crypto from 'crypto';

export interface ICloudProvider extends Document<any> {
    _id: Buffer | string;
    provider_name: string;
    provider_type: string;
    account_name: string;
    account_id: string;
    region: string;
    credentials?: string;
    credentials_iv?: string;
    auth_tag?: string;
    status: string;
    is_deleted: boolean;
    created_at: Date;
    updated_at: Date;
}

const cloudProviderSchema = new Schema<ICloudProvider>({
    _id: { type: 'UUID', default: () => crypto.randomUUID() },
    provider_name: { type: String, required: true, index: true },
    provider_type: { type: String, required: true, index: true },
    account_name: { type: String, required: true },
    account_id: { type: String, required: true, unique: true },
    region: { type: String, required: true },
    credentials: { type: String },
    credentials_iv: { type: String },
    auth_tag: { type: String },
    status: { type: String, default: 'active' },
    is_deleted: { type: Boolean, default: false }
}, { collection: 'cloud_providers' });

cloudProviderSchema.plugin(BaseModelPlugin);

export const CloudProvider = mongoose.model<ICloudProvider>('CloudProvider', cloudProviderSchema);
