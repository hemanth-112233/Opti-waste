import mongoose, { Schema, Document } from 'mongoose';
import { BaseModelPlugin } from './BaseModelPlugin';
import crypto from 'crypto';
import { IOptimizationRecommendation } from './OptimizationRecommendation';

export interface IRecommendationHistory extends Document<any> {
    _id: Buffer | string;
    recommendation: IOptimizationRecommendation['_id'] | any;
    action_taken: string;
    accepted: boolean;
    implemented_at: Date | null;
    verified_at: Date | null;
}

const recommendationHistorySchema = new Schema<IRecommendationHistory>({
    _id: { type: 'UUID', default: () => crypto.randomUUID() },
    recommendation: { type: 'UUID', ref: 'OptimizationRecommendation', required: true },
    action_taken: { type: String, required: true },
    accepted: { type: Boolean, required: true, index: true },
    implemented_at: { type: Date, default: null },
    verified_at: { type: Date, default: null }
}, { collection: 'recommendation_history' });

recommendationHistorySchema.plugin(BaseModelPlugin);

export const RecommendationHistory = mongoose.model<IRecommendationHistory>('RecommendationHistory', recommendationHistorySchema);
