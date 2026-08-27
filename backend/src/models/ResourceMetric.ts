import mongoose, { Schema, Document } from 'mongoose';
import { BaseModelPlugin } from './BaseModelPlugin';
import crypto from 'crypto';
import { ICloudResource } from './CloudResource';

export interface IResourceMetric extends Document<any> {
    _id: Buffer | string;
    resource_id: string;
    cpu_utilization: number;
    memory_utilization: number;
    storage_utilization: number;
    network_in: number;
    network_out: number;
    disk_read: number;
    disk_write: number;
    uptime_hours: number;
    instance_state: string;
    metric_timestamp: Date;
    created_at: Date;
    updated_at: Date;
}

const resourceMetricSchema = new Schema<IResourceMetric>({
    _id: { type: 'UUID', default: () => crypto.randomUUID() },
    resource_id: { type: String, ref: 'CloudResource', required: true, index: true },
    cpu_utilization: { type: Number, default: 0.0 },
    memory_utilization: { type: Number, default: 0.0 },
    storage_utilization: { type: Number, default: 0.0 },
    network_in: { type: Number, default: 0.0 },
    network_out: { type: Number, default: 0.0 },
    disk_read: { type: Number, default: 0.0 },
    disk_write: { type: Number, default: 0.0 },
    uptime_hours: { type: Number, default: 0.0 },
    instance_state: { type: String, default: 'running', index: true },
    metric_timestamp: { type: Date, default: Date.now, index: true }
}, { collection: 'resource_metrics' });

resourceMetricSchema.plugin(BaseModelPlugin);

export const ResourceMetric = mongoose.model<IResourceMetric>('ResourceMetric', resourceMetricSchema);
