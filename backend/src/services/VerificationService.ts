/**
 * VerificationService.ts
 * OptiWaste — Phase 20: Recommendation Verification Engine
 *
 * Closed-loop flow:
 *   OptimizationRecommendation (status=implemented)
 *     → CostRecord baseline (pre-implementation window)
 *     → CostRecord actual  (post-implementation window)
 *     → RecommendationVerification (upsert, idempotent)
 *     → ClosedLoopFeedback  (when verifiable)
 *     → SavingsAnalytics    (when verifiable)
 *
 * Safety:
 *   - Only recommendations with status="implemented" are processed.
 *   - If post-implementation data is insufficient → NOT_VERIFIABLE (never fabricated).
 *   - Upsert key: recommendation._id → fully idempotent.
 *
 * Savings formulae (transparent):
 *   baseline_cost         = avg(daily_cost × 30) over 30 days pre-implementation
 *   post_cost             = avg(daily_cost × 30) over verification_window_days post-implementation
 *   actual_savings        = max(0, baseline_cost – post_cost)
 *   savings_variance      = predicted_savings – actual_savings
 *   prediction_error_pct  = |variance| / predicted_savings × 100  (0 when predicted=0)
 */

import crypto from 'crypto';
import { OptimizationRecommendation } from '../models/OptimizationRecommendation';
import { RecommendationVerification } from '../models/RecommendationVerification';
import { RecommendationHistory } from '../models/RecommendationHistory';
import { ClosedLoopFeedback } from '../models/ClosedLoopFeedback';
import { SavingsAnalytics } from '../models/SavingsAnalytics';
import { CostRecord } from '../models/CostRecord';

// ── Constants ─────────────────────────────────────────────────────────────────

/** Days before implementation used to build the cost baseline */
const BASELINE_WINDOW_DAYS = 30;
/** Minimum post-implementation cost records to attempt verification */
const MIN_POST_SAMPLES = 3;
/** Minimum pre-implementation cost records for a meaningful baseline */
const MIN_PRE_SAMPLES = 3;
/** Days of post-implementation data to collect (max) */
const POST_WINDOW_DAYS = 30;

// ── Types ─────────────────────────────────────────────────────────────────────

export type VerificationStatus =
    | 'pending'
    | 'in_progress'
    | 'verified'
    | 'partially_verified'
    | 'failed'
    | 'not_verifiable';

interface CostWindow {
    avgMonthly: number;
    sampleCount: number;
    windowDays: number;
}

export interface VerificationRunSummary {
    totalProcessed: number;
    verified: number;
    partiallyVerified: number;
    failed: number;
    notVerifiable: number;
    pending: number;
}

export interface VerificationSummary {
    totalVerifications: number;
    verifiedCount: number;
    partiallyVerifiedCount: number;
    failedCount: number;
    notVerifiableCount: number;
    pendingCount: number;
    avgPredictionErrorPct: number;
    totalConfirmedSavings: number;
    totalPredictedSavings: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

function clamp(n: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, n));
}

function daysBetween(a: Date, b: Date): number {
    return Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24);
}

/**
 * Query CostRecord for a resource within a time window.
 * Returns avg monthly cost equivalent and sample count.
 */
async function queryCostWindow(
    resourceId: string,
    from: Date,
    to: Date
): Promise<CostWindow> {
    const records = await CostRecord.find({
        resource_id: resourceId,
        cost_timestamp: { $gte: from, $lte: to },
    }).lean();

    if (!records.length) {
        return { avgMonthly: 0, sampleCount: 0, windowDays: daysBetween(from, to) };
    }

    // Prefer monthly_cost if populated, otherwise derive from daily_cost × 30
    const monthlyValues = records.map(r => {
        if (r.monthly_cost && r.monthly_cost > 0) return r.monthly_cost;
        return (r.daily_cost ?? 0) * 30;
    }).filter(v => v > 0);

    const avg = monthlyValues.length
        ? monthlyValues.reduce((s, v) => s + v, 0) / monthlyValues.length
        : 0;

    return {
        avgMonthly: round2(avg),
        sampleCount: records.length,
        windowDays: round2(daysBetween(from, to)),
    };
}

/**
 * Derive verification status from evidence quality and savings comparison.
 */
function deriveStatus(
    preSamples: number,
    postSamples: number,
    predictedSavings: number,
    actualSavings: number,
    predictionErrorPct: number,
): VerificationStatus {
    // Not enough baseline
    if (preSamples < MIN_PRE_SAMPLES) return 'not_verifiable';
    // Not enough post-implementation data
    if (postSamples < MIN_POST_SAMPLES) return 'not_verifiable';

    // Cost increased → failed
    if (actualSavings < 0) return 'failed';

    // Prediction was reasonably accurate (±20%)
    if (predictionErrorPct <= 20 && actualSavings > 0) return 'verified';

    // Savings exist but prediction was off (20–50%)
    if (predictionErrorPct <= 50 && actualSavings > 0) return 'partially_verified';

    // Savings exist but very inaccurate prediction
    if (actualSavings > 0 && predictionErrorPct > 50) return 'partially_verified';

    // No savings observed with sufficient data
    return 'failed';
}

/**
 * Build human-readable verification notes explaining the decision.
 */
function buildNotes(
    recId: string,
    recType: string,
    anchor: Date,
    preWindow: CostWindow,
    postWindow: CostWindow,
    predicted: number,
    actual: number,
    errorPct: number,
    status: VerificationStatus,
): string {
    const statusReason: Record<VerificationStatus, string> = {
        not_verifiable: `Insufficient cost data (baseline samples: ${preWindow.sampleCount}, post-implementation samples: ${postWindow.sampleCount}). Cannot establish a meaningful comparison — minimum ${MIN_PRE_SAMPLES} records required in each window.`,
        verified: `Verification confirmed. Actual savings ($${actual}) within 20% of predicted ($${predicted}). Prediction error: ${errorPct}%.`,
        partially_verified: `Partial verification. Savings observed ($${actual}) but prediction error is ${errorPct}% (threshold: 20%). May improve with more post-implementation data.`,
        failed: `Verification failed. Actual savings ($${actual}) did not materialise. Cost may have increased or the recommendation was insufficient.`,
        in_progress: `Verification in progress.`,
        pending: `Pending verification.`,
    };

    return [
        `Verification of recommendation [${recType}] (id: ${recId}).`,
        `Implementation anchor: ${anchor.toISOString().split('T')[0]}.`,
        `Baseline window: ${BASELINE_WINDOW_DAYS} days before anchor — avg monthly cost: $${preWindow.avgMonthly} (${preWindow.sampleCount} record(s)).`,
        `Post-implementation window: ${round2(postWindow.windowDays)} day(s) after anchor — avg monthly cost: $${postWindow.avgMonthly} (${postWindow.sampleCount} record(s)).`,
        `Predicted savings: $${predicted}/month.`,
        `Actual savings: $${actual}/month (baseline – post: $${preWindow.avgMonthly} – $${postWindow.avgMonthly} = $${round2(preWindow.avgMonthly - postWindow.avgMonthly)}).`,
        `Prediction error: ${errorPct}%.`,
        `Status decision: ${statusReason[status]}`,
    ].join(' ');
}

/**
 * Compute verification confidence from evidence strength.
 */
function calcVerificationConfidence(
    preSamples: number,
    postSamples: number,
    predictionErrorPct: number,
    postWindowDays: number,
): number {
    let conf = 0.40;
    if (postSamples >= 14) conf += 0.20;
    else if (postSamples >= 7) conf += 0.10;
    if (preSamples >= 14) conf += 0.15;
    if (postWindowDays >= 14) conf += 0.05;
    if (predictionErrorPct < 10 && preSamples >= MIN_PRE_SAMPLES && postSamples >= MIN_POST_SAMPLES) conf += 0.05;
    if (postSamples < MIN_POST_SAMPLES) conf -= 0.10;
    return round2(clamp(conf, 0.10, 0.99));
}

// ── Main service ──────────────────────────────────────────────────────────────

export class VerificationService {

    /**
     * runVerification
     *
     * For each recommendation with status="implemented":
     *   1. Find implementation anchor (RecommendationHistory.implemented_at or generated_at).
     *   2. Query CostRecord baseline (pre-anchor window).
     *   3. Query CostRecord post-implementation (post-anchor window).
     *   4. Compute savings, error, confidence, status.
     *   5. Upsert RecommendationVerification.
     *   6. Create/update ClosedLoopFeedback + SavingsAnalytics when verifiable.
     */
    static async runVerification(options?: { recommendationIds?: string[] }): Promise<VerificationRunSummary> {
        console.log('[VerificationEngine] Starting verification run…');

        // Load implemented recommendations
        const query: any = { status: 'implemented' };
        if (options?.recommendationIds?.length) {
            query._id = { $in: options.recommendationIds };
        }

        const recommendations = await OptimizationRecommendation.find(query).lean();
        console.log(`[VerificationEngine] ${recommendations.length} implemented recommendation(s) found.`);

        const summary: VerificationRunSummary = {
            totalProcessed: recommendations.length,
            verified: 0, partiallyVerified: 0, failed: 0, notVerifiable: 0, pending: 0,
        };

        for (const rec of recommendations) {
            try {
                const recId = String(rec._id);
                const rid = String(rec.resource);

                // ── 1. Find implementation anchor ──────────────────────────────
                const history = await RecommendationHistory.findOne({
                    recommendation: rec._id,
                    accepted: true,
                }).sort({ implemented_at: -1 }).lean();

                const anchor: Date = history?.implemented_at
                    ?? (rec as any).generated_at
                    ?? new Date();

                const now = new Date();
                const preFrom = new Date(anchor.getTime() - BASELINE_WINDOW_DAYS * 86400000);
                const preTo = anchor;
                const postFrom = anchor;
                const postTo = new Date(Math.min(now.getTime(), anchor.getTime() + POST_WINDOW_DAYS * 86400000));

                // ── 2. Query cost windows ──────────────────────────────────────
                const [preWindow, postWindow] = await Promise.all([
                    queryCostWindow(rid, preFrom, preTo),
                    queryCostWindow(rid, postFrom, postTo),
                ]);

                // ── 3. Calculate savings ───────────────────────────────────────
                const predicted = round2(rec.predicted_savings ?? 0);
                const actualRaw = preWindow.avgMonthly - postWindow.avgMonthly;
                const actual = round2(Math.max(0, actualRaw));
                const variance = round2(predicted - actual);
                const errorPct = predicted > 0
                    ? round2(Math.abs(variance) / predicted * 100)
                    : 0;

                // ── 4. Derive status ───────────────────────────────────────────
                const status = deriveStatus(
                    preWindow.sampleCount, postWindow.sampleCount,
                    predicted, actual, errorPct
                );

                const confidence = calcVerificationConfidence(
                    preWindow.sampleCount, postWindow.sampleCount,
                    errorPct, postWindow.windowDays
                );

                const notes = buildNotes(
                    recId, (rec as any).recommendation_type ?? 'unknown',
                    anchor, preWindow, postWindow,
                    predicted, actual, errorPct, status
                );

                const estimatedRisk = predicted > 0 && actual / predicted < 0.5
                    ? 'HIGH'
                    : predicted > 0 && actual / predicted < 0.8 ? 'MEDIUM' : 'LOW';

                // ── 5. Upsert RecommendationVerification ───────────────────────
                await RecommendationVerification.findOneAndUpdate(
                    { recommendation: rec._id },
                    {
                        $setOnInsert: { _id: crypto.randomUUID() },
                        $set: {
                            recommendation: rec._id,
                            verification_status: status,
                            predicted_savings: predicted,
                            estimated_risk: estimatedRisk,
                            confidence_score: confidence,
                            verified_at: new Date(),
                            implementation_date: anchor,
                            verification_window_days: round2(postWindow.windowDays),
                            baseline_cost: preWindow.avgMonthly,
                            post_implementation_cost: postWindow.avgMonthly,
                            actual_savings: actual,
                            savings_variance: variance,
                            prediction_error_pct: errorPct,
                            pre_sample_count: preWindow.sampleCount,
                            post_sample_count: postWindow.sampleCount,
                            verification_notes: notes,
                            updated_at: new Date(),
                        },
                    },
                    { upsert: true, new: true }
                );

                // ── 6. ClosedLoopFeedback (only when comparison is meaningful) ──
                const isComparable = status !== 'not_verifiable' && status !== 'pending';
                if (isComparable) {
                    await ClosedLoopFeedback.findOneAndUpdate(
                        { recommendation: rec._id },
                        {
                            $setOnInsert: { _id: crypto.randomUUID() },
                            $set: {
                                recommendation: rec._id,
                                predicted_savings: predicted,
                                actual_savings: actual,
                                prediction_error: round2(Math.abs(variance)),
                                verification_status: status,
                                feedback_notes: notes,
                                feedback_timestamp: new Date(),
                                updated_at: new Date(),
                            },
                        },
                        { upsert: true, new: true }
                    );

                    // ── 7. SavingsAnalytics (resource-level aggregate) ─────────
                    const pct = predicted > 0 ? round2((actual / predicted) * 100) : 0;
                    await SavingsAnalytics.findOneAndUpdate(
                        { resource: rid },
                        {
                            $setOnInsert: { _id: crypto.randomUUID() },
                            $set: {
                                resource: rid,
                                predicted_savings: predicted,
                                actual_savings: actual,
                                percentage_saved: pct,
                                calculation_date: new Date(),
                                updated_at: new Date(),
                            },
                        },
                        { upsert: true, new: true }
                    );
                }

                // Update summary counts
                switch (status) {
                    case 'verified': summary.verified++; break;
                    case 'partially_verified': summary.partiallyVerified++; break;
                    case 'failed': summary.failed++; break;
                    case 'not_verifiable': summary.notVerifiable++; break;
                    default: summary.pending++; break;
                }

                console.log(`[VerificationEngine] ${recId} → ${status} (predicted: $${predicted}, actual: $${actual})`);

            } catch (err) {
                console.error(`[VerificationEngine] Error verifying ${rec._id}:`, err);
            }
        }

        console.log(`[VerificationEngine] Done. Verified: ${summary.verified}, Partial: ${summary.partiallyVerified}, Failed: ${summary.failed}, N/A: ${summary.notVerifiable}`);
        return summary;
    }

    // ── Read methods ───────────────────────────────────────────────────────────

    static async getVerifications(filters: {
        status?: string;
        recommendation?: string;
        skip?: number;
        limit?: number;
    }) {
        const query: any = {};
        if (filters.status) query.verification_status = filters.status.toLowerCase();
        if (filters.recommendation) query.recommendation = filters.recommendation;

        const skip = filters.skip ?? 0;
        const limit = filters.limit ?? 100;

        const [data, total] = await Promise.all([
            RecommendationVerification.find(query)
                .sort({ verified_at: -1 })
                .skip(skip)
                .limit(limit)
                .populate('recommendation', 'recommendation_title recommendation_type priority predicted_savings status'),
            RecommendationVerification.countDocuments(query),
        ]);

        return { data, total, skip, limit };
    }

    static async getVerification(id: string) {
        return RecommendationVerification.findById(id)
            .populate({
                path: 'recommendation',
                populate: { path: 'resource', select: 'resource_name resource_type monthly_cost environment' },
            });
    }

    static async getSummary(): Promise<VerificationSummary> {
        const [pipeline, errorAgg] = await Promise.all([
            RecommendationVerification.aggregate([
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        verified: { $sum: { $cond: [{ $eq: ['$verification_status', 'verified'] }, 1, 0] } },
                        partial: { $sum: { $cond: [{ $eq: ['$verification_status', 'partially_verified'] }, 1, 0] } },
                        failed: { $sum: { $cond: [{ $eq: ['$verification_status', 'failed'] }, 1, 0] } },
                        notVerifiable: { $sum: { $cond: [{ $eq: ['$verification_status', 'not_verifiable'] }, 1, 0] } },
                        pending: { $sum: { $cond: [{ $in: ['$verification_status', ['pending', 'in_progress']] }, 1, 0] } },
                        totalConfirmed: { $sum: '$actual_savings' },
                        totalPredicted: { $sum: '$predicted_savings' },
                    }
                }
            ]),
            RecommendationVerification.aggregate([
                { $match: { prediction_error_pct: { $gt: 0 }, verification_status: { $nin: ['not_verifiable', 'pending'] } } },
                { $group: { _id: null, avgError: { $avg: '$prediction_error_pct' } } },
            ]),
        ]);

        const base = pipeline[0] ?? {
            total: 0, verified: 0, partial: 0, failed: 0, notVerifiable: 0, pending: 0,
            totalConfirmed: 0, totalPredicted: 0,
        };

        return {
            totalVerifications: base.total,
            verifiedCount: base.verified,
            partiallyVerifiedCount: base.partial,
            failedCount: base.failed,
            notVerifiableCount: base.notVerifiable,
            pendingCount: base.pending,
            avgPredictionErrorPct: round2(errorAgg[0]?.avgError ?? 0),
            totalConfirmedSavings: round2(base.totalConfirmed),
            totalPredictedSavings: round2(base.totalPredicted),
        };
    }
}
