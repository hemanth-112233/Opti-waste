import mongoose, { Schema, Document } from 'mongoose';
import { BaseModelPlugin } from './BaseModelPlugin';
import crypto from 'crypto';
import { IOptimizationRecommendation } from './OptimizationRecommendation';

export interface IClosedLoopFeedback extends Document<any> {
    _id: Buffer | string;
    recommendation: IOptimizationRecommendation['_id'] | any;
    predicted_savings: number;
    actual_savings: number;
    prediction_error: number;
    verification_status: string;
    feedback_notes: string | null;
    feedback_timestamp: Date;
}

const closedLoopFeedbackSchema = new Schema<IClosedLoopFeedback>({
    _id: { type: 'UUID', default: () => crypto.randomUUID() },
    recommendation: { type: 'UUID', ref: 'OptimizationRecommendation', required: true },
    predicted_savings: { type: Number, required: true },
    actual_savings: { type: Number, required: true },
    prediction_error: { type: Number, required: true },
    verification_status: { type: String, required: true, index: true },
    feedback_notes: { type: String, default: null },
    feedback_timestamp: { type: Date, default: Date.now, index: true }
}, { collection: 'closed_loop_feedback' });

closedLoopFeedbackSchema.plugin(BaseModelPlugin);

export const ClosedLoopFeedback = mongoose.model<IClosedLoopFeedback>('ClosedLoopFeedback', closedLoopFeedbackSchema);
