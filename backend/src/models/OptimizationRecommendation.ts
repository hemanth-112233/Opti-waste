import mongoose, { Schema, Document } from 'mongoose';
import { BaseModelPlugin } from './BaseModelPlugin';
import crypto from 'crypto';
import { ICloudResource } from './CloudResource';

export interface IOptimizationRecommendation extends Document<any> {
    _id: Buffer | string;
    resource: ICloudResource['_id'] | any;
    recommendation_title: string;
    recommendation_description: string;
    recommended_action: string;
    predicted_savings: number;
    estimated_impact: string;
    priority: string;
    status: string;
    generated_at: Date;
    // ── Phase 19 extensions (backward-compatible) ───────────────
    /** Source WasteRiskAssessment that triggered this recommendation */
    waste_assessment: string | null;
    /** Waste category that maps to this recommendation */
    recommendation_type: string;
    /** 0–1 recommendation confidence based on evidence quality */
    confidence_score: number;
    /** Full explainable rationale citing measured values */
    recommendation_reason: string;
    /** Human-readable formula used to derive predicted_savings */
    savings_basis: string;
}

const optimizationRecommendationSchema = new Schema<IOptimizationRecommendation>({
    _id: { type: 'UUID', default: () => crypto.randomUUID() },
    resource: { type: 'UUID', ref: 'CloudResource', required: true },
    recommendation_title: { type: String, required: true },
    recommendation_description: { type: String, required: true },
    recommended_action: { type: String, required: true },
    predicted_savings: { type: Number, required: true },
    estimated_impact: { type: String, required: true },
    priority: { type: String, required: true, index: true },
    status: { type: String, default: 'pending', index: true },
    generated_at: { type: Date, default: Date.now, index: true },
    // Phase 19 extensions
    waste_assessment: { type: String, ref: 'WasteRiskAssessment', default: null },
    recommendation_type: { type: String, default: '', index: true },
    confidence_score: { type: Number, default: 0 },
    recommendation_reason: { type: String, default: '' },
    savings_basis: { type: String, default: '' },
}, { collection: 'optimization_recommendations' });

optimizationRecommendationSchema.plugin(BaseModelPlugin);

export const OptimizationRecommendation = mongoose.model<IOptimizationRecommendation>('OptimizationRecommendation', optimizationRecommendationSchema);

