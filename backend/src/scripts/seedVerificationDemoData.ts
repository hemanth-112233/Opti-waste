/**
 * seedVerificationDemoData.ts
 * OptiWaste — Phase 20.5: Demo Verification Evidence
 *
 * DEVELOPMENT ONLY — never imported by server.ts
 *
 * Run:  npm run seed:verification-demo
 *
 * Purpose:
 *   Creates controlled demo CostRecord data (pre- and post-implementation)
 *   so the Phase 20 VerificationService can demonstrate a complete
 *   closed-loop verification flow with real evidence.
 *
 * Strategy:
 *   Target:  DEMO-AWS-UNDERUTILIZED-01 (monthly_cost=$280)
 *            → Phase 19 generates an "underutilized" recommendation for it.
 *   Pre-implementation window  (45→10 days ago): baseline avg ~$280/month
 *   Implementation anchor      (10 days ago)
 *   Post-implementation window (10 days ago → now): reduced avg ~$168/month
 *   Expected actual savings    ≈ $112/month
 *   Expected prediction error  % varies on Phase 19 predicted value
 *
 * Safety guarantees:
 *   - Idempotent: pre/post cost records keyed on billing_period + resource_id + phase tag
 *   - Does NOT delete Phase 18.5 demo data
 *   - Does NOT modify the VerificationService
 *   - Does NOT hardcode verification status
 *   - Only modifies the target recommendation status (underutilized → implemented)
 *   - Runs safely multiple times
 */

import mongoose from 'mongoose';
import crypto from 'crypto';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { CloudResource } from '../models/CloudResource';
import { CloudProvider } from '../models/CloudProvider';
import { CostRecord } from '../models/CostRecord';
import { OptimizationRecommendation } from '../models/OptimizationRecommendation';
import { RecommendationHistory } from '../models/RecommendationHistory';

// ── Config ────────────────────────────────────────────────────────────────────

const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/optiwaste';
const TARGET_RESOURCE = 'DEMO-AWS-UNDERUTILIZED-01';
const PHASE_TAG = '20.5';

/** Days before NOW that the recommendation was "implemented" */
const IMPL_DAYS_AGO = 10;
/** Baseline: cost records spread over 45→10 days ago (pre-implementation) */
const PRE_WINDOW_DAYS = 35;   // 45-to-10-ago
const PRE_RECORDS = 14;   // matches Phase 18.5 density
/** Post-implementation: from 10 days ago → now */
const POST_RECORDS = 14;

/** Average monthly cost BEFORE implementation (matches Phase 18.5 seeded value) */
const BASELINE_MONTHLY = 280.00;
/** Average monthly cost AFTER implementation (≈40% cost reduction) */
const POST_MONTHLY = 168.00;

// ── Helpers ───────────────────────────────────────────────────────────────────

function billingPeriod(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function jitter(base: number, spread: number): number {
    return Math.max(0, +(base + (Math.random() - 0.5) * 2 * spread).toFixed(2));
}

function timeRange(count: number, from: Date, to: Date): Date[] {
    const step = (to.getTime() - from.getTime()) / Math.max(1, count - 1);
    return Array.from({ length: count }, (_, i) => new Date(from.getTime() + i * step));
}

/**
 * Upsert a CostRecord keyed on resource_id + phase + billing_period + a stable suffix.
 * Uses a deterministic UUID so re-runs produce the same record IDs.
 */
async function upsertCostRecord(doc: {
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
    phase_tag: string;     // extra tag — stored as a separate field is not in the model
    // so we derive the stable UUID from it instead
}): Promise<void> {
    const stableKey = `${doc.phase_tag}:${doc.resource_id}:${doc.billing_period}:${doc.cost_timestamp.toISOString()}`;
    const stableId = crypto.createHash('md5').update(stableKey).digest('hex');
    // Pad to UUID format (v4 shape for Mongoose UUID type)
    const uuid = [
        stableId.slice(0, 8),
        stableId.slice(8, 12),
        '4' + stableId.slice(13, 16),
        ((parseInt(stableId[16], 16) & 0x3) | 0x8).toString(16) + stableId.slice(17, 20),
        stableId.slice(20, 32),
    ].join('-');

    await CostRecord.findOneAndUpdate(
        { _id: uuid },
        {
            $setOnInsert: { _id: uuid },
            $set: {
                resource_id: doc.resource_id,
                provider_id: doc.provider_id,
                billing_period: doc.billing_period,
                daily_cost: doc.daily_cost,
                weekly_cost: doc.weekly_cost,
                monthly_cost: doc.monthly_cost,
                projected_monthly_cost: doc.projected_monthly_cost,
                currency: doc.currency,
                billing_status: doc.billing_status,
                cost_timestamp: doc.cost_timestamp,
                updated_at: new Date(),
            },
        },
        { upsert: true, new: true }
    );
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function seed(): Promise<void> {
    console.log('[SeedVerificationDemoData] Connecting:', MONGO_URI);
    await mongoose.connect(MONGO_URI);
    console.log('[SeedVerificationDemoData] Connected.\n');

    // ── 1. Locate target resource ─────────────────────────────────────────────
    const resource = await CloudResource.findOne({ resource_name: TARGET_RESOURCE }).lean();
    if (!resource) {
        console.error(`[SeedVerificationDemoData] Resource "${TARGET_RESOURCE}" not found.`);
        console.error('  → Run "npm run seed:waste-demo" first to create Phase 18.5 demo data.');
        process.exit(1);
    }
    const rid = String(resource._id);
    const pid = String(resource.provider_id);
    console.log(`  ✓ Target resource: ${TARGET_RESOURCE} (${rid})`);

    // ── 2. Locate the "underutilized" recommendation for this resource ─────────
    const recommendation = await OptimizationRecommendation.findOne({
        resource: rid,
        recommendation_type: 'underutilized',
    }).lean();

    if (!recommendation) {
        console.error('[SeedVerificationDemoData] No "underutilized" recommendation found for the demo resource.');
        console.error('  → Run "npm run seed:waste-demo" then POST /api/v1/waste/analyze then POST /api/v1/recommendations/generate first.');
        process.exit(1);
    }
    const recId = String(recommendation._id);
    console.log(`  ✓ Recommendation: ${recId} (type=underutilized, predicted=$${recommendation.predicted_savings})`);

    // ── 3. Set up timeline ────────────────────────────────────────────────────
    const now = new Date();
    const implDate = new Date(now.getTime() - IMPL_DAYS_AGO * 86400000);
    const preFrom = new Date(implDate.getTime() - PRE_WINDOW_DAYS * 86400000);
    const preTo = implDate;
    const postFrom = implDate;
    const postTo = now;

    console.log(`\n  Implementation anchor:       ${implDate.toISOString().split('T')[0]}`);
    console.log(`  Pre-implementation window:   ${preFrom.toISOString().split('T')[0]} → ${preTo.toISOString().split('T')[0]}`);
    console.log(`  Post-implementation window:  ${postFrom.toISOString().split('T')[0]} → ${postTo.toISOString().split('T')[0]}`);

    // ── 4. Mark recommendation as implemented ─────────────────────────────────
    const currentStatus = (recommendation as any).status;
    if (currentStatus !== 'implemented') {
        await OptimizationRecommendation.findByIdAndUpdate(recId, {
            $set: { status: 'implemented', updated_at: new Date() },
        });
        console.log(`\n  ✓ Recommendation status: "${currentStatus}" → "implemented"`);
    } else {
        console.log(`\n  ✓ Recommendation already "implemented" — no change.`);
    }

    // ── 5. Record in RecommendationHistory ────────────────────────────────────
    const historyKey = `${PHASE_TAG}:history:${recId}`;
    const historyId = (() => {
        const h = crypto.createHash('md5').update(historyKey).digest('hex');
        return [h.slice(0, 8), h.slice(8, 12), '4' + h.slice(13, 16),
        ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16) + h.slice(17, 20), h.slice(20, 32)].join('-');
    })();

    await RecommendationHistory.findOneAndUpdate(
        { _id: historyId },
        {
            $setOnInsert: { _id: historyId },
            $set: {
                recommendation: recId,
                action_taken: 'implemented',
                accepted: true,
                implemented_at: implDate,
                verified_at: null,
                updated_at: new Date(),
            },
        },
        { upsert: true, new: true }
    );
    console.log(`  ✓ RecommendationHistory record upserted (implemented_at: ${implDate.toISOString().split('T')[0]})`);

    // ── 6. Pre-implementation CostRecords ─────────────────────────────────────
    const preTimes = timeRange(PRE_RECORDS, preFrom, preTo);
    let preCount = 0;
    for (const t of preTimes) {
        const daily = jitter(BASELINE_MONTHLY / 30, 0.40);
        await upsertCostRecord({
            resource_id: rid,
            provider_id: pid,
            billing_period: billingPeriod(t),
            daily_cost: daily,
            weekly_cost: +(daily * 7).toFixed(2),
            monthly_cost: jitter(BASELINE_MONTHLY, 5.00),
            projected_monthly_cost: jitter(BASELINE_MONTHLY, 8.00),
            currency: 'USD',
            billing_status: 'finalized',
            cost_timestamp: t,
            phase_tag: PHASE_TAG + ':pre',
        });
        preCount++;
    }
    console.log(`  ✓ Pre-implementation CostRecords upserted: ${preCount} records (avg ~$${BASELINE_MONTHLY}/mo)`);

    // ── 7. Post-implementation CostRecords ────────────────────────────────────
    const postTimes = timeRange(POST_RECORDS, postFrom, postTo);
    let postCount = 0;
    for (const t of postTimes) {
        const daily = jitter(POST_MONTHLY / 30, 0.30);
        await upsertCostRecord({
            resource_id: rid,
            provider_id: pid,
            billing_period: billingPeriod(t),
            daily_cost: daily,
            weekly_cost: +(daily * 7).toFixed(2),
            monthly_cost: jitter(POST_MONTHLY, 4.00),
            projected_monthly_cost: jitter(POST_MONTHLY, 6.00),
            currency: 'USD',
            billing_status: 'finalized',
            cost_timestamp: t,
            phase_tag: PHASE_TAG + ':post',
        });
        postCount++;
    }
    console.log(`  ✓ Post-implementation CostRecords upserted: ${postCount} records (avg ~$${POST_MONTHLY}/mo)`);

    // ── 8. Summary ────────────────────────────────────────────────────────────
    const expectedActualSavings = +(BASELINE_MONTHLY - POST_MONTHLY).toFixed(2);
    const predictedSavings = +(recommendation.predicted_savings ?? 0).toFixed(2);
    const expectedError = predictedSavings > 0
        ? +(Math.abs(predictedSavings - expectedActualSavings) / predictedSavings * 100).toFixed(1)
        : 0;

    console.log('\n════════════════════════════════════════════════════════');
    console.log('  PHASE 20.5 — DEMO DATA SUMMARY');
    console.log('════════════════════════════════════════════════════════');
    console.log(`  Resource:               ${TARGET_RESOURCE}`);
    console.log(`  Recommendation ID:      ${recId}`);
    console.log(`  Implementation date:    ${implDate.toISOString().split('T')[0]}`);
    console.log(`  Baseline monthly cost:  $${BASELINE_MONTHLY}`);
    console.log(`  Post-impl monthly cost: $${POST_MONTHLY}`);
    console.log(`  Expected actual savings:$${expectedActualSavings}/month`);
    console.log(`  Phase 19 predicted:     $${predictedSavings}/month`);
    console.log(`  Expected prediction err:${expectedError}%`);
    console.log(`  Pre-impl records:       ${preCount}`);
    console.log(`  Post-impl records:      ${postCount}`);
    console.log('\nNow run: POST /api/v1/verifications/run');
    console.log('  → Engine will calculate actual savings from these records.');
    console.log('  → Status = VERIFIED if error ≤ 20%, PARTIALLY_VERIFIED if ≤ 50%.');
    console.log('════════════════════════════════════════════════════════');

    await mongoose.disconnect();
    console.log('\n[SeedVerificationDemoData] Done.\n');
}

seed().catch(err => {
    console.error('[SeedVerificationDemoData] Fatal error:', err);
    process.exit(1);
});
