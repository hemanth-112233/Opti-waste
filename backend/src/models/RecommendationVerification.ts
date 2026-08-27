import mongoose, { Schema, Document } from 'mongoose';
import { BaseModelPlugin } from './BaseModelPlugin';
import crypto from 'crypto';
import { IOptimizationRecommendation } from './OptimizationRecommendation';

export interface IRecommendationVerification extends Document<any> {
    _id: Buffer | string;
    recommendation: IOptimizationRecommendation['_id'] | any;
    verification_status: string;
    predicted_savings: number;
    estimated_risk: string;
    confidence_score: number;
    verified_at: Date;
    // ── Phase 20 extensions (backward-compatible) ────────────────────
    /** Date the recommendation was implemented (baseline anchor) */
    implementation_date: Date | null;
    /** Days of post-implementation data used for comparison */
    verification_window_days: number;
    /** Average monthly cost before implementation */
    baseline_cost: number;
    /** Average monthly cost after implementation */
    post_implementation_cost: number;
    /** baseline_cost – post_implementation_cost (actual monetary saving) */
    actual_savings: number;
    /** predicted_savings – actual_savings */
    savings_variance: number;
    /** |predicted – actual| / predicted × 100  (0 when predicted = 0) */
    prediction_error_pct: number;
    /** Number of cost records used for the baseline window */
    pre_sample_count: number;
    /** Number of cost records used for the post-implementation window */
    post_sample_count: number;
    /** Human-readable audit trail explaining the verification decision */
    verification_notes: string;
}

const recommendationVerificationSchema = new Schema<IRecommendationVerification>({
    _id: { type: 'UUID', default: () => crypto.randomUUID() },
    recommendation: { type: 'UUID', ref: 'OptimizationRecommendation', required: true },
    verification_status: { type: String, required: true, index: true },
    predicted_savings: { type: Number, required: true },
    estimated_risk: { type: String, required: true },
    confidence_score: { type: Number, required: true },
    verified_at: { type: Date, default: Date.now, index: true },
    // Phase 20 extensions
    implementation_date: { type: Date, default: null },
    verification_window_days: { type: Number, default: 0 },
    baseline_cost: { type: Number, default: 0 },
    post_implementation_cost: { type: Number, default: 0 },
    actual_savings: { type: Number, default: 0 },
    savings_variance: { type: Number, default: 0 },
    prediction_error_pct: { type: Number, default: 0 },
    pre_sample_count: { type: Number, default: 0 },
    post_sample_count: { type: Number, default: 0 },
    verification_notes: { type: String, default: '' },
}, { collection: 'recommendation_verifications' });

recommendationVerificationSchema.plugin(BaseModelPlugin);

export const RecommendationVerification = mongoose.model<IRecommendationVerification>(
    'RecommendationVerification',
    recommendationVerificationSchema
);
