import mongoose, { Schema, Document } from 'mongoose';
import { BaseModelPlugin } from './BaseModelPlugin';
import crypto from 'crypto';
import { ICloudResource } from './CloudResource';

export interface IWasteAssessmentHistory extends Document<any> {
    _id: Buffer | string;
    resource: ICloudResource['_id'] | any;
    previous_score: number;
    current_score: number;
    risk_level: string;
    assessment_date: Date;
}

const wasteAssessmentHistorySchema = new Schema<IWasteAssessmentHistory>({
    _id: { type: 'UUID', default: () => crypto.randomUUID() },
    resource: { type: 'UUID', ref: 'CloudResource', required: true },
    previous_score: { type: Number, required: true },
    current_score: { type: Number, required: true },
    risk_level: { type: String, required: true, index: true },
    assessment_date: { type: Date, default: Date.now, index: true }
}, { collection: 'waste_assessment_history' });

wasteAssessmentHistorySchema.plugin(BaseModelPlugin);

export const WasteAssessmentHistory = mongoose.model<IWasteAssessmentHistory>('WasteAssessmentHistory', wasteAssessmentHistorySchema);
