import mongoose, { Schema, Document } from 'mongoose';
import { BaseModelPlugin } from './BaseModelPlugin';
import crypto from 'crypto';
import { ICloudResource } from './CloudResource';

export interface IWasteRiskAssessment extends Document<any> {
    _id: Buffer | string;
    resource: ICloudResource['_id'] | any;
    risk_score: number;
    risk_level: string;
    assessment_reason: string;
    confidence_score: number;
    assessment_timestamp: Date;
    /** Nullable — only set when actual cost data supports the calculation */
    estimated_waste_cost: number | null;
    /** Array of waste category labels detected for this resource */
    waste_categories: string[];
}

const wasteRiskAssessmentSchema = new Schema<IWasteRiskAssessment>({
    _id: { type: 'UUID', default: () => crypto.randomUUID() },
    resource: { type: 'UUID', ref: 'CloudResource', required: true },
    risk_score: { type: Number, required: true },
    risk_level: { type: String, required: true, index: true },
    assessment_reason: { type: String, required: true },
    confidence_score: { type: Number, required: true },
    assessment_timestamp: { type: Date, default: Date.now, index: true },
    // Phase 18 extensions — backward-compatible, both optional
    estimated_waste_cost: { type: Number, default: null },
    waste_categories: { type: [String], default: [] },
}, { collection: 'waste_risk_assessments' });

wasteRiskAssessmentSchema.plugin(BaseModelPlugin);

export const WasteRiskAssessment = mongoose.model<IWasteRiskAssessment>('WasteRiskAssessment', wasteRiskAssessmentSchema);
