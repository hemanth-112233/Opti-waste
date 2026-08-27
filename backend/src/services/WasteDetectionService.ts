/**
 * OptiWaste — Phase 18: Cloud Waste Detection Engine
 * WasteDetectionService.ts
 *
 * Reads cloud_resources, resource_metrics, and cost_records.
 * Writes (upserts) to waste_risk_assessments and waste_assessment_history.
 * Never modifies the source collections.
 *
 * Scoring formula (0–100):
 *   base_score  = weighted sum of detected category scores
 *   final_score = min(100, base_score)
 *
 * Category weights (additive, capped at 100):
 *   idle               → up to 60 pts
 *   underutilized      → up to 40 pts
 *   overprovisioned    → up to 35 pts
 *   unattached_storage → up to 50 pts
 *   storage_waste      → up to 30 pts
 *   cost_anomaly       → up to 45 pts
 *
 * Confidence formula:
 *   starts at 0.5 (low baseline)
 *   +0.2 if ≥ MIN_SAMPLES_HIGH_CONFIDENCE (24) samples
 *   +0.1 if ≥ MIN_SAMPLES_MEDIUM_CONFIDENCE (6) samples
 *   +0.1 if cost data is present
 *   +0.1 if all three utilization metrics are available
 *   clamped to [0, 1.0]
 */

import crypto from 'crypto';
import { CloudResource } from '../models/CloudResource';
import { ResourceMetric } from '../models/ResourceMetric';
import { CostRecord } from '../models/CostRecord';
import { WasteRiskAssessment } from '../models/WasteRiskAssessment';
import { WasteAssessmentHistory } from '../models/WasteAssessmentHistory';
import {
    UNDERUTILIZATION_CPU_THRESHOLD,
    UNDERUTILIZATION_MEMORY_THRESHOLD,
    IDLE_CPU_THRESHOLD,
    IDLE_NETWORK_THRESHOLD,
    STORAGE_WASTE_THRESHOLD,
    OVERPROVISIONED_CPU_THRESHOLD,
    OVERPROVISIONED_MEMORY_THRESHOLD,
    MIN_SAMPLES_FOR_CLASSIFICATION,
    MIN_SAMPLES_HIGH_CONFIDENCE,
    MIN_SAMPLES_MEDIUM_CONFIDENCE,
    OBSERVATION_WINDOW_DAYS,
    COST_PROJECTION_SPIKE_RATIO,
    getRiskLevel,
    type WasteCategory,
} from '../config/wasteConstants';

// Internal shape for one resource's aggregated metric data
interface MetricSummary {
    sampleCount: number;
    avgCpu: number;
    avgMemory: number;
    avgStorage: number;
    avgNetworkIn: number;
    avgNetworkOut: number;
    avgDiskRead: number;
    avgDiskWrite: number;
    hasStoppedSamples: boolean;
    earliestTimestamp: Date | null;
    latestTimestamp: Date | null;
}

// Internal shape for one resource's cost data
interface CostSummary {
    hasData: boolean;
    latestMonthly: number;
    latestProjected: number;
    avgDaily: number;
    maxDaily: number;
}

// Per-resource analysis result (internal)
interface WasteFinding {
    resourceId: string;
    categories: WasteCategory[];
    riskScore: number;
    riskLevel: string;
    confidenceScore: number;
    assessmentReason: string;
    estimatedWasteCost: number | null;
}

// Public summary returned from runAnalysis()
export interface AnalysisSummary {
    totalResourcesAnalyzed: number;
    totalFindings: number;
    highRiskFindings: number;
    estimatedWasteCost: number;
    categoryCounts: Record<WasteCategory, number>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper utilities
// ─────────────────────────────────────────────────────────────────────────────

function avg(arr: number[]): number {
    if (!arr.length) return 0;
    return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function roundTwo(n: number): number {
    return Math.round(n * 100) / 100;
}

function daysBetween(a: Date, b: Date): number {
    return Math.abs(b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24);
}

/** Build a human-readable observation window description */
function observationDesc(m: MetricSummary): string {
    if (!m.earliestTimestamp || !m.latestTimestamp) return 'unknown observation window';
    const days = roundTwo(daysBetween(m.earliestTimestamp, m.latestTimestamp));
    return `${m.sampleCount} observations over ${days} day(s)`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Confidence score builder
// ─────────────────────────────────────────────────────────────────────────────
function calcConfidence(m: MetricSummary, c: CostSummary): number {
    let conf = 0.3; // baseline — we have at least the resource document

    if (m.sampleCount >= MIN_SAMPLES_HIGH_CONFIDENCE) {
        conf += 0.30;
    } else if (m.sampleCount >= MIN_SAMPLES_MEDIUM_CONFIDENCE) {
        conf += 0.20;
    } else if (m.sampleCount >= MIN_SAMPLES_FOR_CLASSIFICATION) {
        conf += 0.10;
    }

    if (c.hasData) conf += 0.15;
    if (m.avgCpu > 0 || m.avgMemory > 0 || m.avgStorage > 0) conf += 0.10;
    if (m.sampleCount >= MIN_SAMPLES_HIGH_CONFIDENCE && c.hasData) conf += 0.15;

    return roundTwo(Math.min(1.0, conf));
}

// ─────────────────────────────────────────────────────────────────────────────
// Waste category detectors
// ─────────────────────────────────────────────────────────────────────────────

interface CategoryResult {
    detected: boolean;
    score: number;     // contribution to total risk score (0–60 depending on category)
    reason: string;
}

function detectIdle(
    resource: any,
    m: MetricSummary
): CategoryResult {
    // Stopped state with sufficient evidence
    if (resource.status === 'stopped' &&
        m.sampleCount >= MIN_SAMPLES_FOR_CLASSIFICATION &&
        m.hasStoppedSamples) {
        return {
            detected: true,
            score: 60,
            reason: `Resource remained in a stopped state across ${observationDesc(m)}.`
        };
    }

    // Running but statistically idle
    if (m.sampleCount >= MIN_SAMPLES_FOR_CLASSIFICATION &&
        m.avgCpu < IDLE_CPU_THRESHOLD &&
        m.avgNetworkIn < IDLE_NETWORK_THRESHOLD &&
        m.avgNetworkOut < IDLE_NETWORK_THRESHOLD) {
        const scaledScore = Math.round(50 * (1 - m.avgCpu / IDLE_CPU_THRESHOLD));
        return {
            detected: true,
            score: Math.min(55, scaledScore),
            reason: `Average CPU utilization was ${roundTwo(m.avgCpu)}% and average network in/out were ${roundTwo(m.avgNetworkIn)}/${roundTwo(m.avgNetworkOut)} across ${observationDesc(m)}, consistent with an idle resource.`
        };
    }

    return { detected: false, score: 0, reason: '' };
}

function detectUnderutilized(m: MetricSummary): CategoryResult {
    if (m.sampleCount < MIN_SAMPLES_FOR_CLASSIFICATION) {
        return { detected: false, score: 0, reason: '' };
    }

    const cpuLow = m.avgCpu < UNDERUTILIZATION_CPU_THRESHOLD;
    const memLow = m.avgMemory < UNDERUTILIZATION_MEMORY_THRESHOLD;

    if (!cpuLow && !memLow) return { detected: false, score: 0, reason: '' };

    // Both signals strengthen the finding
    let score = 0;
    const parts: string[] = [];

    if (cpuLow) {
        score += Math.round(20 * (1 - m.avgCpu / UNDERUTILIZATION_CPU_THRESHOLD));
        parts.push(`avg CPU ${roundTwo(m.avgCpu)}% (threshold ${UNDERUTILIZATION_CPU_THRESHOLD}%)`);
    }
    if (memLow) {
        score += Math.round(20 * (1 - m.avgMemory / UNDERUTILIZATION_MEMORY_THRESHOLD));
        parts.push(`avg memory ${roundTwo(m.avgMemory)}% (threshold ${UNDERUTILIZATION_MEMORY_THRESHOLD}%)`);
    }

    return {
        detected: true,
        score: Math.min(40, score),
        reason: `Resource is persistently underutilized — ${parts.join('; ')} — across ${observationDesc(m)}.`
    };
}

function detectOverprovisioned(resource: any, m: MetricSummary): CategoryResult {
    if (m.sampleCount < MIN_SAMPLES_FOR_CLASSIFICATION) {
        return { detected: false, score: 0, reason: '' };
    }

    const allocCpu = resource.cpu ?? 0;
    const allocMem = resource.memory ?? 0;      // GB
    const cpuLow = m.avgCpu < OVERPROVISIONED_CPU_THRESHOLD;
    const memLow = m.avgMemory < OVERPROVISIONED_MEMORY_THRESHOLD;

    if (!cpuLow && !memLow) return { detected: false, score: 0, reason: '' };

    let score = 0;
    const parts: string[] = [];

    if (cpuLow && allocCpu > 0) {
        score += 18;
        parts.push(`Allocated CPU: ${allocCpu} vCPU — avg utilization: ${roundTwo(m.avgCpu)}%`);
    }
    if (memLow && allocMem > 0) {
        score += 17;
        parts.push(`Allocated memory: ${allocMem} GB — avg utilization: ${roundTwo(m.avgMemory)}%`);
    }

    return {
        detected: score > 0,
        score: Math.min(35, score),
        reason: `Resource appears overprovisioned. ${parts.join('. ')}. Sampled across ${observationDesc(m)}.`
    };
}

function detectUnattachedStorage(resource: any, m: MetricSummary): CategoryResult {
    const type = (resource.resource_type as string || '').toLowerCase();
    const isStorageType =
        type.includes('volume') || type.includes('disk') ||
        type.includes('ebs') || type.includes('persistent') ||
        type.includes('blob') || type.includes('storage');

    if (!isStorageType) return { detected: false, score: 0, reason: '' };
    if (m.sampleCount < MIN_SAMPLES_FOR_CLASSIFICATION) return { detected: false, score: 0, reason: '' };

    const diskActivityNearZero =
        m.avgDiskRead < 1 &&
        m.avgDiskWrite < 1;

    if (!diskActivityNearZero) return { detected: false, score: 0, reason: '' };

    return {
        detected: true,
        score: 50,
        reason: `Potentially unattached storage detected. Resource type "${resource.resource_type}" shows near-zero disk read (${roundTwo(m.avgDiskRead)}) and disk write (${roundTwo(m.avgDiskWrite)}) activity across ${observationDesc(m)}. Note: no explicit attachment field exists in this schema — finding based on inferred disk inactivity.`
    };
}

function detectStorageWaste(resource: any, m: MetricSummary): CategoryResult {
    const allocStorage = resource.storage ?? 0;
    if (allocStorage <= 0 || m.sampleCount < MIN_SAMPLES_FOR_CLASSIFICATION) {
        return { detected: false, score: 0, reason: '' };
    }

    const avgStorageUtil = m.avgStorage;
    if (avgStorageUtil >= STORAGE_WASTE_THRESHOLD) return { detected: false, score: 0, reason: '' };

    const unusedFraction = 1 - avgStorageUtil / 100;
    const unusedGb = roundTwo(allocStorage * unusedFraction);
    const score = Math.round(30 * (1 - avgStorageUtil / STORAGE_WASTE_THRESHOLD));

    return {
        detected: true,
        score: Math.min(30, score),
        reason: `Storage waste detected. Allocated: ${allocStorage} GB, avg utilization: ${roundTwo(avgStorageUtil)}%, estimated unused capacity: ${unusedGb} GB across ${observationDesc(m)}.`
    };
}

function detectCostAnomaly(c: CostSummary): CategoryResult {
    if (!c.hasData) return { detected: false, score: 0, reason: '' };

    const parts: string[] = [];
    let score = 0;

    // Projection spike
    if (c.latestProjected > 0 && c.latestMonthly > 0) {
        const ratio = c.latestProjected / c.latestMonthly;
        if (ratio >= COST_PROJECTION_SPIKE_RATIO) {
            const excess = roundTwo(c.latestProjected - c.latestMonthly);
            score += Math.min(30, Math.round(15 * ratio));
            parts.push(`Projected monthly cost ($${roundTwo(c.latestProjected)}) is ${roundTwo(ratio)}× the current monthly cost ($${roundTwo(c.latestMonthly)}), an excess of $${excess}.`);
        }
    }

    // Daily cost spike vs. baseline (if baseline > 0)
    if (c.avgDaily > 0 && c.maxDaily > c.avgDaily * 2) {
        score += 20;
        parts.push(`Maximum daily cost ($${roundTwo(c.maxDaily)}) is ${roundTwo(c.maxDaily / c.avgDaily)}× the average daily baseline ($${roundTwo(c.avgDaily)}).`);
    }

    if (!parts.length) return { detected: false, score: 0, reason: '' };

    return {
        detected: true,
        score: Math.min(45, score),
        reason: `Cost anomaly detected. ${parts.join(' ')}`
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Estimated waste cost
// ─────────────────────────────────────────────────────────────────────────────

function calcEstimatedWasteCost(
    categories: WasteCategory[],
    resource: any,
    m: MetricSummary,
    c: CostSummary
): number | null {
    if (!c.hasData || c.latestMonthly <= 0) return null;

    // Idle: full monthly cost is waste
    if (categories.includes('idle')) {
        return roundTwo(c.latestMonthly);
    }

    // Unattached storage: full cost
    if (categories.includes('unattached_storage')) {
        return roundTwo(c.latestMonthly);
    }

    // Underutilized / overprovisioned: fraction of monthly cost proportional to excess
    if (categories.includes('underutilized') || categories.includes('overprovisioned')) {
        const cpuExcess = Math.max(0, (UNDERUTILIZATION_CPU_THRESHOLD - m.avgCpu) / 100);
        const memExcess = Math.max(0, (UNDERUTILIZATION_MEMORY_THRESHOLD - m.avgMemory) / 100);
        const wastedFraction = (cpuExcess + memExcess) / 2;
        return roundTwo(c.latestMonthly * wastedFraction);
    }

    // Storage waste: compute proportionally
    if (categories.includes('storage_waste')) {
        const unusedFraction = Math.max(0, 1 - m.avgStorage / 100);
        return roundTwo(c.latestMonthly * unusedFraction);
    }

    return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main analysis engine
// ─────────────────────────────────────────────────────────────────────────────

export class WasteDetectionService {

    /**
     * runAnalysis
     *
     * 1. Load all active resources.
     * 2. Batch-load metrics for all resources in one aggregation pipeline.
     * 3. Batch-load latest cost records per resource.
     * 4. Evaluate each resource against all waste categories.
     * 5. Upsert WasteRiskAssessment; record history when score changes significantly.
     * 6. Return analysis summary.
     */
    static async runAnalysis(): Promise<AnalysisSummary> {
        // ── 1. Load active resources ─────────────────────────────────────────
        const resources = await CloudResource.find({ is_deleted: false }).lean();
        console.log(`[WasteDetection] Analyzing ${resources.length} active resource(s).`);

        // ── 2. Batch-load metric summaries (one pipeline for all resources) ──
        const metricCutoff = new Date();
        metricCutoff.setDate(metricCutoff.getDate() - OBSERVATION_WINDOW_DAYS);

        const metricAgg = await ResourceMetric.aggregate([
            { $match: { metric_timestamp: { $gte: metricCutoff } } },
            {
                $group: {
                    _id: '$resource_id',
                    sampleCount: { $sum: 1 },
                    avgCpu: { $avg: '$cpu_utilization' },
                    avgMemory: { $avg: '$memory_utilization' },
                    avgStorage: { $avg: '$storage_utilization' },
                    avgNetworkIn: { $avg: '$network_in' },
                    avgNetworkOut: { $avg: '$network_out' },
                    avgDiskRead: { $avg: '$disk_read' },
                    avgDiskWrite: { $avg: '$disk_write' },
                    hasStoppedSamples: {
                        $max: {
                            $cond: [{ $eq: ['$instance_state', 'stopped'] }, 1, 0]
                        }
                    },
                    earliest: { $min: '$metric_timestamp' },
                    latest: { $max: '$metric_timestamp' },
                }
            }
        ]);

        const metricMap = new Map<string, MetricSummary>();
        for (const row of metricAgg) {
            metricMap.set(String(row._id), {
                sampleCount: row.sampleCount,
                avgCpu: row.avgCpu ?? 0,
                avgMemory: row.avgMemory ?? 0,
                avgStorage: row.avgStorage ?? 0,
                avgNetworkIn: row.avgNetworkIn ?? 0,
                avgNetworkOut: row.avgNetworkOut ?? 0,
                avgDiskRead: row.avgDiskRead ?? 0,
                avgDiskWrite: row.avgDiskWrite ?? 0,
                hasStoppedSamples: row.hasStoppedSamples === 1,
                earliestTimestamp: row.earliest ?? null,
                latestTimestamp: row.latest ?? null,
            });
        }

        // ── 3. Batch-load cost records ────────────────────────────────────────
        const costAgg = await CostRecord.aggregate([
            {
                $group: {
                    _id: '$resource_id',
                    latestMonthly: { $last: '$monthly_cost' },
                    latestProjected: { $last: '$projected_monthly_cost' },
                    avgDaily: { $avg: '$daily_cost' },
                    maxDaily: { $max: '$daily_cost' },
                    count: { $sum: 1 },
                }
            }
        ]);

        const costMap = new Map<string, CostSummary>();
        for (const row of costAgg) {
            costMap.set(String(row._id), {
                hasData: true,
                latestMonthly: row.latestMonthly ?? 0,
                latestProjected: row.latestProjected ?? 0,
                avgDaily: row.avgDaily ?? 0,
                maxDaily: row.maxDaily ?? 0,
            });
        }

        // ── 4. Evaluate each resource ────────────────────────────────────────
        const findings: WasteFinding[] = [];
        const zeroSummary: MetricSummary = {
            sampleCount: 0, avgCpu: 0, avgMemory: 0, avgStorage: 0,
            avgNetworkIn: 0, avgNetworkOut: 0, avgDiskRead: 0, avgDiskWrite: 0,
            hasStoppedSamples: false, earliestTimestamp: null, latestTimestamp: null,
        };
        const zeroCost: CostSummary = {
            hasData: false, latestMonthly: 0, latestProjected: 0, avgDaily: 0, maxDaily: 0
        };

        for (const resource of resources) {
            try {
                const rid = String(resource._id);
                const m = metricMap.get(rid) ?? zeroSummary;
                const c = costMap.get(rid) ?? zeroCost;

                const finding = WasteDetectionService._analyzeResource(resource, m, c);
                if (finding) findings.push(finding);

                await WasteDetectionService._persistFinding(resource._id, finding);
            } catch (err) {
                console.error(`[WasteDetection] Error analyzing resource ${resource._id}:`, err);
                // continue with other resources
            }
        }

        // ── 5. Build summary ─────────────────────────────────────────────────
        const categoryCounts: Record<WasteCategory, number> = {
            idle: 0, underutilized: 0, overprovisioned: 0,
            unattached_storage: 0, storage_waste: 0, cost_anomaly: 0
        };

        let totalWasteCost = 0;
        let highRiskCount = 0;

        for (const f of findings) {
            for (const cat of f.categories) categoryCounts[cat]++;
            if (f.estimatedWasteCost) totalWasteCost += f.estimatedWasteCost;
            if (f.riskLevel === 'HIGH' || f.riskLevel === 'CRITICAL') highRiskCount++;
        }

        return {
            totalResourcesAnalyzed: resources.length,
            totalFindings: findings.length,
            highRiskFindings: highRiskCount,
            estimatedWasteCost: roundTwo(totalWasteCost),
            categoryCounts,
        };
    }

    // ── Core per-resource analyzer ─────────────────────────────────────────
    static _analyzeResource(
        resource: any,
        m: MetricSummary,
        c: CostSummary
    ): WasteFinding | null {

        const categories: WasteCategory[] = [];
        const reasonParts: string[] = [];
        let totalScore = 0;

        // Run all detectors
        const idle = detectIdle(resource, m);
        const underutil = detectUnderutilized(m);
        const overprov = detectOverprovisioned(resource, m);
        const unattached = detectUnattachedStorage(resource, m);
        const storageWaste = detectStorageWaste(resource, m);
        const costAnomaly = detectCostAnomaly(c);

        // Collect detected categories and scores
        // Idle is dominant: if detected, skip underutilized/overprovisioned to avoid redundancy
        if (idle.detected) {
            categories.push('idle');
            reasonParts.push(idle.reason);
            totalScore += idle.score;
        } else {
            if (underutil.detected) {
                categories.push('underutilized');
                reasonParts.push(underutil.reason);
                totalScore += underutil.score;
            }
            if (overprov.detected && !underutil.detected) {
                // only flag overprovisioned independently
                categories.push('overprovisioned');
                reasonParts.push(overprov.reason);
                totalScore += overprov.score;
            }
        }

        if (unattached.detected) {
            categories.push('unattached_storage');
            reasonParts.push(unattached.reason);
            totalScore += unattached.score;
        } else if (storageWaste.detected) {
            categories.push('storage_waste');
            reasonParts.push(storageWaste.reason);
            totalScore += storageWaste.score;
        }

        if (costAnomaly.detected) {
            categories.push('cost_anomaly');
            reasonParts.push(costAnomaly.reason);
            totalScore += costAnomaly.score;
        }

        // No waste detected → not a finding
        if (!categories.length) return null;

        const finalScore = Math.min(100, totalScore);
        const riskLevel = getRiskLevel(finalScore);
        const confidence = calcConfidence(m, c);
        const wasteCost = calcEstimatedWasteCost(categories, resource, m, c);

        return {
            resourceId: String(resource._id),
            categories,
            riskScore: finalScore,
            riskLevel,
            confidenceScore: confidence,
            assessmentReason: reasonParts.join('\n\n'),
            estimatedWasteCost: wasteCost,
        };
    }

    // ── Persist / upsert WasteRiskAssessment ──────────────────────────────
    static async _persistFinding(
        resourceId: any,
        finding: WasteFinding | null
    ): Promise<void> {
        if (!finding) return;

        const existing = await WasteRiskAssessment.findOne({ resource: resourceId });
        const prevScore = existing?.risk_score ?? null;

        if (existing) {
            existing.risk_score = finding.riskScore;
            existing.risk_level = finding.riskLevel;
            existing.assessment_reason = finding.assessmentReason;
            existing.confidence_score = finding.confidenceScore;
            existing.assessment_timestamp = new Date();
            existing.estimated_waste_cost = finding.estimatedWasteCost ?? null;
            existing.waste_categories = finding.categories;
            await existing.save();
        } else {
            await WasteRiskAssessment.create({
                _id: crypto.randomUUID(),
                resource: resourceId,
                risk_score: finding.riskScore,
                risk_level: finding.riskLevel,
                assessment_reason: finding.assessmentReason,
                confidence_score: finding.confidenceScore,
                assessment_timestamp: new Date(),
                estimated_waste_cost: finding.estimatedWasteCost ?? null,
                waste_categories: finding.categories,
            });
        }

        // Record history when the score has changed meaningfully (≥ 5 pts)
        if (prevScore !== null && Math.abs(prevScore - finding.riskScore) >= 5) {
            await WasteAssessmentHistory.create({
                _id: crypto.randomUUID(),
                resource: resourceId,
                previous_score: prevScore,
                current_score: finding.riskScore,
                risk_level: finding.riskLevel,
                assessment_date: new Date(),
            });
        }
    }

    // ── Read methods ───────────────────────────────────────────────────────

    static async getFindings(filters: {
        risk_level?: string;
        resource?: string;
        category?: string;
        skip?: number;
        limit?: number;
    }) {
        const query: any = {};
        if (filters.risk_level) query.risk_level = filters.risk_level.toUpperCase();
        if (filters.resource) query.resource = filters.resource;
        if (filters.category) query.waste_categories = filters.category;

        const skip = filters.skip ?? 0;
        const limit = filters.limit ?? 100;

        const [data, total] = await Promise.all([
            WasteRiskAssessment.find(query)
                .sort('-assessment_timestamp')
                .skip(skip)
                .limit(limit)
                .populate('resource', 'resource_name resource_type provider_type environment monthly_cost'),
            WasteRiskAssessment.countDocuments(query)
        ]);

        return { data, total, skip, limit };
    }

    static async getFinding(id: string) {
        return WasteRiskAssessment.findById(id)
            .populate('resource');
    }

    static async getSummary() {
        const pipeline = await WasteRiskAssessment.aggregate([
            {
                $group: {
                    _id: null,
                    totalFindings: { $sum: 1 },
                    lowRisk: { $sum: { $cond: [{ $eq: ['$risk_level', 'LOW'] }, 1, 0] } },
                    mediumRisk: { $sum: { $cond: [{ $eq: ['$risk_level', 'MEDIUM'] }, 1, 0] } },
                    highRisk: { $sum: { $cond: [{ $eq: ['$risk_level', 'HIGH'] }, 1, 0] } },
                    criticalRisk: { $sum: { $cond: [{ $eq: ['$risk_level', 'CRITICAL'] }, 1, 0] } },
                    estimatedWaste: { $sum: { $ifNull: ['$estimated_waste_cost', 0] } },
                }
            }
        ]);

        const base = pipeline[0] ?? {
            totalFindings: 0, lowRisk: 0, mediumRisk: 0, highRisk: 0,
            criticalRisk: 0, estimatedWaste: 0
        };

        // Category counts from stored waste_categories arrays
        const catCounts = await WasteRiskAssessment.aggregate([
            { $unwind: '$waste_categories' },
            { $group: { _id: '$waste_categories', count: { $sum: 1 } } }
        ]);

        const categories: Record<string, number> = {};
        for (const row of catCounts) categories[row._id] = row.count;

        return {
            totalFindings: base.totalFindings,
            lowRisk: base.lowRisk,
            mediumRisk: base.mediumRisk,
            highRisk: base.highRisk,
            criticalRisk: base.criticalRisk,
            estimatedWasteCost: roundTwo(base.estimatedWaste),
            idleResources: categories['idle'] ?? 0,
            underutilizedResources: categories['underutilized'] ?? 0,
            overprovisionedResources: categories['overprovisioned'] ?? 0,
            unattachedStorage: categories['unattached_storage'] ?? 0,
            storageWaste: categories['storage_waste'] ?? 0,
            costAnomalies: categories['cost_anomaly'] ?? 0,
        };
    }
}
