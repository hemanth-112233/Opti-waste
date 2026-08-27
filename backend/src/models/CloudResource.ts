import mongoose, { Schema, Document } from 'mongoose';
import { BaseModelPlugin } from './BaseModelPlugin';
import crypto from 'crypto';
import { ICloudProvider } from './CloudProvider';

export interface ICloudResource extends Document<any> {
    _id: Buffer | string;
    provider_id: string; // Ref CloudProvider
    provider_type: string;
    resource_name: string;
    resource_type: string;
    instance_type: string | null;
    service_name: string;
    region: string;
    availability_zone: string | null;
    cpu: number;
    memory: number;
    storage: number;
    operating_system: string | null;
    status: string;
    owner: string | null;
    project_name: string | null;
    environment: string;
    monthly_cost: number;
    tags: Record<string, any>;
    last_synced: Date | null;
    is_deleted: boolean;
    created_at: Date;
    updated_at: Date;
}

const cloudResourceSchema = new Schema<ICloudResource>({
    _id: { type: 'UUID', default: () => crypto.randomUUID() },
    provider_id: { type: String, ref: 'CloudProvider', required: true, index: true },
    provider_type: { type: String, required: true },
    resource_name: { type: String, required: true },
    resource_type: { type: String, required: true, index: true },
    instance_type: { type: String, default: null },
    service_name: { type: String, required: true, index: true },
    region: { type: String, required: true, index: true },
    availability_zone: { type: String, default: null },
    cpu: { type: Number, default: 0 },
    memory: { type: Number, default: 0 },
    storage: { type: Number, default: 0 },
    operating_system: { type: String, default: null },
    status: { type: String, required: true, index: true },
    owner: { type: String, default: null },
    project_name: { type: String, default: null },
    environment: { type: String, default: 'Development', index: true },
    monthly_cost: { type: Number, default: 0.0 },
    tags: { type: Schema.Types.Mixed, default: {} },
    last_synced: { type: Date, default: null },
    is_deleted: { type: Boolean, default: false }
}, { collection: 'cloud_resources' });

cloudResourceSchema.plugin(BaseModelPlugin);

export const CloudResource = mongoose.model<ICloudResource>('CloudResource', cloudResourceSchema);
