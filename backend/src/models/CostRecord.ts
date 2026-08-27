import mongoose, { Schema, Document } from 'mongoose';
import { BaseModelPlugin } from './BaseModelPlugin';
import crypto from 'crypto';
import { ICloudResource } from './CloudResource';
import { ICloudProvider } from './CloudProvider';

export interface ICostRecord extends Document<any> {
    _id: Buffer | string;
    resource_id: string;
    provider_id: string;
    billing_period: string;
    daily_cost: number;
    weekly_cost: number;
    monthly_cost: number;
    projected_monthly_cost: number;
    currency: string;
    billing_status: string;
    cost_timestamp: Date;
    created_at: Date;
    updated_at: Date;
}

const costRecordSchema = new Schema<ICostRecord>({
    _id: { type: 'UUID', default: () => crypto.randomUUID() },
    resource_id: { type: String, ref: 'CloudResource', required: true },
    provider_id: { type: String, ref: 'CloudProvider', required: true },
    billing_period: { type: String, required: true, index: true },
    daily_cost: { type: Number, default: 0.0 },
    weekly_cost: { type: Number, default: 0.0 },
    monthly_cost: { type: Number, default: 0.0 },
    projected_monthly_cost: { type: Number, default: 0.0 },
    currency: { type: String, default: 'USD', index: true },
    billing_status: { type: String, default: 'pending', index: true },
    cost_timestamp: { type: Date, default: Date.now, index: true }
}, { collection: 'cost_records' });

costRecordSchema.plugin(BaseModelPlugin);

export const CostRecord = mongoose.model<ICostRecord>('CostRecord', costRecordSchema);
