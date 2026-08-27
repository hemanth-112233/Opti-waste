import mongoose, { Schema, Document } from 'mongoose';
import { BaseModelPlugin } from './BaseModelPlugin';
import crypto from 'crypto';
import { ICloudResource } from './CloudResource';

export interface ISavingsAnalytics extends Document<any> {
    _id: Buffer | string;
    resource: ICloudResource['_id'] | any;
    predicted_savings: number;
    actual_savings: number;
    percentage_saved: number;
    calculation_date: Date;
}

const savingsAnalyticsSchema = new Schema<ISavingsAnalytics>({
    _id: { type: 'UUID', default: () => crypto.randomUUID() },
    resource: { type: 'UUID', ref: 'CloudResource', required: true },
    predicted_savings: { type: Number, required: true },
    actual_savings: { type: Number, required: true },
    percentage_saved: { type: Number, required: true },
    calculation_date: { type: Date, default: Date.now, index: true }
}, { collection: 'savings_analytics' });

savingsAnalyticsSchema.plugin(BaseModelPlugin);

export const SavingsAnalytics = mongoose.model<ISavingsAnalytics>('SavingsAnalytics', savingsAnalyticsSchema);
