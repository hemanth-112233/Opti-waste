/**
 * OptimizationRecommendationService.ts
 * OptiWaste — Phase 19: Optimization Recommendation Engine
 *
 * Converts WasteRiskAssessment findings into actionable, explainable recommendations.
 *
 * Flow:
 *   WasteRiskAssessment → CloudResource + ResourceMetric avg + CostRecord
 *       → OptimizationRecommendation (upsert per resource+type)
 *
 * Safety:
 *   - Advisory only. No infrastructure is modified.
 *   - Recommendations default to status="pending".
 *   - Upsert key: (resource, recommendation_type) — idempotent.
 */

import crypto from 'crypto';
import { WasteRiskAssessment } from '../models/WasteRiskAssessment';
import { OptimizationRecommendation } from '../models/OptimizationRecommendation';
import { CloudResource } from '../models/CloudResource';
import { ResourceMetric } from '../models/ResourceMetric';
import { CostRecord } from '../models/CostRecord';

// ── Types ─────────────────────────────────────────────────────────────────────

type RecommendationCategory =
    | 'idle'
    | 'underutilized'
    | 'overprovisioned'
    | 'unattached_storage'
    | 'storage_waste'
    | 'cost_anomaly';

interface MetricAvg {
    avgCpu: number;
    avgMemory: number;
    avgStorage: number;
    avgDiskRead: number;
    avgDiskWrite: number;
    sampleCount: number;
    windowDays: number;
}

interface CostData {
    hasData: boolean;
    latestMonthly: number;
    latestProjected: number;
    avgDaily: number;
    maxDaily: number;
    hasFinalizedRecords: boolean;
}

export interface GenerationSummary {
    totalAssessmentsProcessed: number;
    totalRecommendationsGenerated: number;
    estimatedTotalSavings: number;
    priorityCounts: Record<string, number>;
    categoryCounts: Record<string, number>;
}

export interface RecommendationSummary {
    totalRecommendations: number;
    pendingCount: number;
    acceptedCount: number;
    dismissedCount: number;
    implementedCount: number;
    estimatedTotalSavings: number;
    priorityCounts: Record<string, number>;
    typeCounts: Record<string, number>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function round2(n: number): number {
    return Math.round(n * 100) / 100;
}

function clamp(n: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, n));
}

/** Derive recommendation priority from waste risk_level + resource environment */
function derivePriority(riskLevel: string, environment: string): string {
    const isProduction = environment?.toLowerCase() === 'production';
    if (riskLevel === 'CRITICAL') return 'CRITICAL';
    if (riskLevel === 'HIGH') return isProduction ? 'CRITICAL' : 'HIGH';
    if (riskLevel === 'MEDIUM') return isProduction ? 'HIGH' : 'MEDIUM';
    return 'LOW';
}

/** Derive confidence from base waste confidence + modifiers */
function deriveConfidence(
    wasteConfidence: number,
    cost: CostData,
    environment: string
): number {
    let conf = wasteConfidence;
    if (cost.hasData && cost.latestMonthly > 0) conf += 0.05;
    if (cost.hasFinalizedRecords) conf += 0.05;
    else conf -= 0.10;                                    // estimated billing → less certain
    if (environment?.toLowerCase() === 'production') conf -= 0.05; // higher action bar
    return round2(clamp(conf, 0.10, 0.99));
}

/** Map estimated_impact label from priority */
function impactLabel(priority: string): string {
    const map: Record<string, string> = {
        CRITICAL: 'CRITICAL',
        HIGH: 'HIGH',
        MEDIUM: 'MEDIUM',
        LOW: 'LOW',
    };
    return map[priority] ?? 'LOW';
}

// ── Savings calculators (one per category) ────────────────────────────────────

function savingsIdle(monthly: number, confidence: number): { savings: number; basis: string } {
    // Idle resource: 100% of monthly cost is recoverable
    const savings = round2(monthly);
    const basis = `monthly_cost = $${monthly} → 100% recoverable (idle resource). savings = $${savings}`;
    return { savings, basis };
}

function savingsUnderutilized(monthly: number, avgCpu: number, confidence: number): { savings: number; basis: string } {
    // Fraction of cost proportional to unused CPU capacity × confidence
    const unusedFraction = clamp((1 - avgCpu / 100) * confidence, 0, 0.90);
    const savings = round2(monthly * unusedFraction);
    const basis = `monthly_cost($${monthly}) × (1 – avgCpu/100)(${round2(1 - avgCpu / 100)}) × confidence(${confidence}) = $${savings}`;
    return { savings, basis };
}

function savingsOverprovisioned(monthly: number, avgCpu: number, avgMemory: number, confidence: number): { savings: number; basis: string } {
    // Peak utilisation = max(cpu, memory). Savings = cost × (1 – peak) × 0.7 × confidence
    const peak = Math.max(avgCpu, avgMemory) / 100;
    const factor = clamp((1 - peak) * 0.70 * confidence, 0, 0.80);
    const savings = round2(monthly * factor);
    const basis = `monthly_cost($${monthly}) × (1 – max(avgCpu,avgMem)/100)(${round2(1 - peak)}) × 0.70 × confidence(${confidence}) = $${savings}`;
    return { savings, basis };
}

function savingsUnattachedStorage(monthly: number, confidence: number): { savings: number; basis: string } {
    // Storage with no I/O: 90% of cost recoverable (advisory)
    const savings = round2(monthly * 0.90 * confidence);
    const basis = `monthly_cost($${monthly}) × 0.90 (advisory, inferred unattached) × confidence(${confidence}) = $${savings}`;
    return { savings, basis };
}

function savingsStorageWaste(monthly: number, avgStorageUtil: number, confidence: number): { savings: number; basis: string } {
    // Wasted fraction of storage allocation × 0.80
    const unusedFraction = clamp(1 - avgStorageUtil / 100, 0, 1);
    const savings = round2(monthly * unusedFraction * 0.80 * confidence);
    const basis = `monthly_cost($${monthly}) × (1 – avgStorageUtil/100)(${round2(unusedFraction)}) × 0.80 × confidence(${confidence}) = $${savings}`;
    return { savings, basis };
}

function savingsCostAnomaly(monthly: number, projected: number, avgDaily: number): { savings: number; basis: string } {
    // Recoverable = excess projected above baseline
    const excess = round2(Math.max(0, projected - monthly));
    const basis = `projected_monthly($${projected}) – monthly_cost($${monthly}) = $${excess} excess spend`;
    return { savings: excess, basis };
}

// ── Per-category recommendation builder ───────────────────────────────────────

interface RecommendationBlueprint {
    recommendation_type: RecommendationCategory;
    recommendation_title: string;
    recommendation_description: string;
    recommended_action: string;
    recommendation_reason: string;
    predicted_savings: number;
    savings_basis: string;
    estimated_impact: string;
    priority: string;
    confidence_score: number;
}

function buildBlueprint(
    category: RecommendationCategory,
    resource: any,
    assessment: any,
    metrics: MetricAvg,
    cost: CostData,
): RecommendationBlueprint {
    const priority = derivePriority(assessment.risk_level, resource.environment ?? '');
    const conf = deriveConfidence(assessment.confidence_score, cost, resource.environment ?? '');
    const monthly = cost.hasData ? cost.latestMonthly : (resource.monthly_cost ?? 0);
    const name = resource.resource_name ?? resource._id;
    const itype = resource.instance_type ? ` (${resource.instance_type})` : '';
    const samplesDesc = `${metrics.sampleCount} observation(s) over ~${metrics.windowDays} day(s)`;

    switch (category) {
        case 'idle': {
            const { savings, basis } = savingsIdle(monthly, conf);
            const reason =
                `IDLE detected for ${name}${itype}. ` +
                `The resource has been in a stopped or statistically idle state. ` +
                `Average CPU: ${metrics.avgCpu}%, average network activity near zero. ` +
                `Evidence from ${samplesDesc}. ` +
                `Monthly cost: $${monthly}. Estimated recoverable: $${savings}/month.`;
            return {
                recommendation_type: 'idle',
                recommendation_title: `Terminate or stop idle resource: ${name}`,
                recommendation_description:
                    `This resource shows consistent idle behaviour with near-zero utilisation. ` +
                    `Stopping or terminating it (after owner confirmation) would eliminate its cost.`,
                recommended_action:
                    `Confirm with the resource owner (${resource.owner ?? 'unknown'}) that ` +
                    `${name} is no longer required, then stop or decommission it.`,
                recommendation_reason: reason,
                predicted_savings: savings,
                savings_basis: basis,
                estimated_impact: impactLabel(priority),
                priority,
                confidence_score: conf,
            };
        }

        case 'underutilized': {
            const { savings, basis } = savingsUnderutilized(monthly, metrics.avgCpu, conf);
            const reason =
                `UNDERUTILIZED detected for ${name}${itype}. ` +
                `CPU averaged ${metrics.avgCpu}% and memory ${metrics.avgMemory}% ` +
                `across ${samplesDesc}. ` +
                `Current monthly cost: $${monthly}. Estimated savings if right-sized: $${savings}/month.`;
            return {
                recommendation_type: 'underutilized',
                recommendation_title: `Right-size underutilized resource: ${name}`,
                recommendation_description:
                    `This resource is consistently using a fraction of its allocated capacity. ` +
                    `Downsizing the instance type would reduce cost while maintaining headroom.`,
                recommended_action:
                    `Downsize ${name}${itype} to a smaller instance type. ` +
                    `Target: an instance whose vCPU/RAM provisioning is ≥ 1.5× the observed peak utilisation.`,
                recommendation_reason: reason,
                predicted_savings: savings,
                savings_basis: basis,
                estimated_impact: impactLabel(priority),
                priority,
                confidence_score: conf,
            };
        }

        case 'overprovisioned': {
            const { savings, basis } = savingsOverprovisioned(monthly, metrics.avgCpu, metrics.avgMemory, conf);
            const reason =
                `OVERPROVISIONED detected for ${name}${itype}. ` +
                `Allocated: ${resource.cpu ?? '?'} vCPU / ${resource.memory ?? '?'} GB RAM. ` +
                `Observed avg CPU: ${metrics.avgCpu}%, avg memory: ${metrics.avgMemory}% ` +
                `across ${samplesDesc}. ` +
                `Monthly cost: $${monthly}. Estimated savings: $${savings}/month.`;
            return {
                recommendation_type: 'overprovisioned',
                recommendation_title: `Reduce allocated capacity: ${name}`,
                recommendation_description:
                    `This resource has significantly more CPU and memory than it uses. ` +
                    `Reducing its allocation to match observed demand would lower cost substantially.`,
                recommended_action:
                    `Resize ${name}${itype} to match observed peak utilisation. ` +
                    `Target instance should provide ≥ 2× actual peak utilisation as headroom.`,
                recommendation_reason: reason,
                predicted_savings: savings,
                savings_basis: basis,
                estimated_impact: impactLabel(priority),
                priority,
                confidence_score: conf,
            };
        }

        case 'unattached_storage': {
            const { savings, basis } = savingsUnattachedStorage(monthly, conf);
            const reason =
                `POTENTIALLY UNATTACHED STORAGE detected for ${name}. ` +
                `Resource type: ${resource.resource_type}. ` +
                `Near-zero disk read (avg ${metrics.avgDiskRead}) and disk write (avg ${metrics.avgDiskWrite}) ` +
                `across ${samplesDesc} suggests the volume may not be actively used. ` +
                `Note: attachment status is inferred from I/O absence; verify before deletion. ` +
                `Monthly cost: $${monthly}. Estimated recoverable: $${savings}/month (advisory).`;
            return {
                recommendation_type: 'unattached_storage',
                recommendation_title: `Reclaim potentially unattached storage: ${name}`,
                recommendation_description:
                    `This storage resource shows near-zero I/O activity, suggesting it may not be ` +
                    `attached to any active workload. Verifying and reclaiming it would eliminate its cost.`,
                recommended_action:
                    `Verify that ${name} is not attached to any active instance. ` +
                    `If confirmed unattached, create a final snapshot for archival then delete the volume.`,
                recommendation_reason: reason,
                predicted_savings: savings,
                savings_basis: basis,
                estimated_impact: impactLabel(priority),
                priority,
                confidence_score: conf,
            };
        }

        case 'storage_waste': {
            const { savings, basis } = savingsStorageWaste(monthly, metrics.avgStorage, conf);
            const allocatedGb = resource.storage ?? 0;
            const usedGb = round2(allocatedGb * (metrics.avgStorage / 100));
            const reason =
                `STORAGE WASTE detected for ${name}. ` +
                `Allocated: ${allocatedGb} GB, avg utilisation: ${metrics.avgStorage}% (~${usedGb} GB used) ` +
                `across ${samplesDesc}. ` +
                `Monthly cost: $${monthly}. Estimated savings if allocation is reduced: $${savings}/month.`;
            return {
                recommendation_type: 'storage_waste',
                recommendation_title: `Reduce oversized storage allocation: ${name}`,
                recommendation_description:
                    `This resource allocates far more storage than it uses. ` +
                    `Reducing the allocation or migrating to a more appropriate storage tier would recover cost.`,
                recommended_action:
                    `Reduce storage allocation for ${name} from ${allocatedGb} GB to approximately ` +
                    `${Math.ceil(usedGb * 1.3)} GB (used capacity × 1.3 headroom factor). ` +
                    `Or migrate data to a cold/archival storage tier if access frequency is low.`,
                recommendation_reason: reason,
                predicted_savings: savings,
                savings_basis: basis,
                estimated_impact: impactLabel(priority),
                priority,
                confidence_score: conf,
            };
        }

        case 'cost_anomaly': {
            const { savings, basis } = savingsCostAnomaly(monthly, cost.latestProjected, cost.avgDaily);
            const ratio = cost.latestMonthly > 0
                ? round2(cost.latestProjected / cost.latestMonthly)
                : 'N/A';
            const reason =
                `COST ANOMALY detected for ${name}. ` +
                `Projected monthly cost ($${cost.latestProjected}) is ${ratio}× the baseline monthly cost ($${monthly}). ` +
                `Maximum observed daily cost: $${cost.maxDaily} vs avg daily baseline: $${cost.avgDaily}. ` +
                `Excess spend estimate: $${savings}/month.`;
            return {
                recommendation_type: 'cost_anomaly',
                recommendation_title: `Investigate cost spike: ${name}`,
                recommendation_description:
                    `This resource has experienced a significant recent cost spike where projected spend ` +
                    `substantially exceeds the historical baseline. Root cause investigation is recommended.`,
                recommended_action:
                    `Review the billing records for ${name} for the current period. ` +
                    `Identify the cost driver (e.g. accidental data transfer, auto-scaling event, ` +
                    `or configuration change) and remediate or set billing alerts.`,
                recommendation_reason: reason,
                predicted_savings: savings,
                savings_basis: basis,
                estimated_impact: impactLabel(priority),
                priority,
                confidence_score: conf,
            };
        }
    }
}

// ── Main service class ────────────────────────────────────────────────────────

export class OptimizationRecommendationService {

    /**
     * runGeneration
     *
     * 1. Load all WasteRiskAssessments (optionally filtered by id).
     * 2. Batch-load CloudResource, latest metric averages, latest cost data.
     * 3. For each assessment × each waste category → build a blueprint.
     * 4. Upsert OptimizationRecommendation (key: resource + recommendation_type).
     * 5. Return generation summary.
     */
    static async runGeneration(options?: { wasteIds?: string[] }): Promise<GenerationSummary> {
        console.log('[RecommendationEngine] Starting recommendation generation…');

        // ── 1. Load relevant WasteRiskAssessments ─────────────────────────────
        const query: any = {};
        if (options?.wasteIds?.length) query._id = { $in: options.wasteIds };

        const assessments = await WasteRiskAssessment.find(query).lean();
        console.log(`[RecommendationEngine] Processing ${assessments.length} waste assessment(s).`);

        if (!assessments.length) {
            return {
                totalAssessmentsProcessed: 0,
                totalRecommendationsGenerated: 0,
                estimatedTotalSavings: 0,
                priorityCounts: { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 },
                categoryCounts: {},
            };
        }

        // ── 2. Batch-load resources ────────────────────────────────────────────
        const resourceIds = assessments.map(a => a.resource);
        const resources = await CloudResource.find({ _id: { $in: resourceIds } }).lean();
        const resourceMap = new Map<string, any>(resources.map(r => [String(r._id), r]));

        // ── 3. Batch-load metric averages (30-day window) ─────────────────────
        const windowDays = 30;
        const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

        const metricAgg = await ResourceMetric.aggregate([
            { $match: { resource_id: { $in: resourceIds.map(String) }, metric_timestamp: { $gte: cutoff } } },
            {
                $group: {
                    _id: '$resource_id',
                    avgCpu: { $avg: '$cpu_utilization' },
                    avgMemory: { $avg: '$memory_utilization' },
                    avgStorage: { $avg: '$storage_utilization' },
                    avgDiskRead: { $avg: '$disk_read' },
                    avgDiskWrite: { $avg: '$disk_write' },
                    sampleCount: { $sum: 1 },
                    earliest: { $min: '$metric_timestamp' },
                    latest: { $max: '$metric_timestamp' },
                }
            }
        ]);

        const metricMap = new Map<string, MetricAvg>();
        for (const row of metricAgg) {
            const days = row.earliest && row.latest
                ? round2(Math.abs(row.latest.getTime() - row.earliest.getTime()) / (1000 * 60 * 60 * 24))
                : windowDays;
            metricMap.set(String(row._id), {
                avgCpu: round2(row.avgCpu ?? 0),
                avgMemory: round2(row.avgMemory ?? 0),
                avgStorage: round2(row.avgStorage ?? 0),
                avgDiskRead: round2(row.avgDiskRead ?? 0),
                avgDiskWrite: round2(row.avgDiskWrite ?? 0),
                sampleCount: row.sampleCount ?? 0,
                windowDays: round2(days),
            });
        }

        // ── 4. Batch-load cost data ────────────────────────────────────────────
        const costAgg = await CostRecord.aggregate([
            { $match: { resource_id: { $in: resourceIds.map(String) } } },
            {
                $group: {
                    _id: '$resource_id',
                    latestMonthly: { $last: '$monthly_cost' },
                    latestProjected: { $last: '$projected_monthly_cost' },
                    avgDaily: { $avg: '$daily_cost' },
                    maxDaily: { $max: '$daily_cost' },
                    hasFinalizedRecords: {
                        $max: { $cond: [{ $eq: ['$billing_status', 'finalized'] }, 1, 0] }
                    },
                    count: { $sum: 1 },
                }
            }
        ]);

        const costMap = new Map<string, CostData>();
        for (const row of costAgg) {
            costMap.set(String(row._id), {
                hasData: true,
                latestMonthly: round2(row.latestMonthly ?? 0),
                latestProjected: round2(row.latestProjected ?? 0),
                avgDaily: round2(row.avgDaily ?? 0),
                maxDaily: round2(row.maxDaily ?? 0),
                hasFinalizedRecords: row.hasFinalizedRecords === 1,
            });
        }

        const zeroCost: CostData = {
            hasData: false, latestMonthly: 0, latestProjected: 0,
            avgDaily: 0, maxDaily: 0, hasFinalizedRecords: false,
        };
        const zeroMetrics: MetricAvg = {
            avgCpu: 0, avgMemory: 0, avgStorage: 0,
            avgDiskRead: 0, avgDiskWrite: 0, sampleCount: 0, windowDays,
        };

        // ── 5. Generate and upsert recommendations ─────────────────────────────
        let totalGenerated = 0;
        let totalSavings = 0;
        const priorityCounts: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
        const categoryCounts: Record<string, number> = {};

        for (const assessment of assessments) {
            const rid = String(assessment.resource);
            const resource = resourceMap.get(rid);
            if (!resource) continue;

            const metrics = metricMap.get(rid) ?? zeroMetrics;
            const cost = costMap.get(rid) ?? zeroCost;

            const categories = (assessment.waste_categories ?? []) as RecommendationCategory[];
            if (!categories.length) continue;

            for (const category of categories) {
                try {
                    const bp = buildBlueprint(category, resource, assessment, metrics, cost);

                    await OptimizationRecommendation.findOneAndUpdate(
                        { resource: rid, recommendation_type: category },
                        {
                            $setOnInsert: { _id: crypto.randomUUID(), status: 'pending' },
                            $set: {
                                resource: rid,
                                waste_assessment: String(assessment._id),
                                recommendation_type: bp.recommendation_type,
                                recommendation_title: bp.recommendation_title,
                                recommendation_description: bp.recommendation_description,
                                recommended_action: bp.recommended_action,
                                recommendation_reason: bp.recommendation_reason,
                                predicted_savings: bp.predicted_savings,
                                savings_basis: bp.savings_basis,
                                estimated_impact: bp.estimated_impact,
                                priority: bp.priority,
                                confidence_score: bp.confidence_score,
                                generated_at: new Date(),
                                updated_at: new Date(),
                            },
                        },
                        { upsert: true, new: true }
                    );

                    totalGenerated++;
                    totalSavings += bp.predicted_savings;
                    priorityCounts[bp.priority] = (priorityCounts[bp.priority] ?? 0) + 1;
                    categoryCounts[category] = (categoryCounts[category] ?? 0) + 1;

                } catch (err) {
                    console.error(`[RecommendationEngine] Error generating ${category} for ${rid}:`, err);
                }
            }
        }

        console.log(`[RecommendationEngine] Generated ${totalGenerated} recommendation(s). Estimated savings: $${round2(totalSavings)}/month.`);

        return {
            totalAssessmentsProcessed: assessments.length,
            totalRecommendationsGenerated: totalGenerated,
            estimatedTotalSavings: round2(totalSavings),
            priorityCounts,
            categoryCounts,
        };
    }

    // ── Read methods ───────────────────────────────────────────────────────────

    static async getRecommendations(filters: {
        priority?: string;
        status?: string;
        recommendation_type?: string;
        resource?: string;
        skip?: number;
        limit?: number;
    }) {
        const query: any = {};
        if (filters.priority) query.priority = filters.priority.toUpperCase();
        if (filters.status) query.status = filters.status.toLowerCase();
        if (filters.recommendation_type) query.recommendation_type = filters.recommendation_type.toLowerCase();
        if (filters.resource) query.resource = filters.resource;

        const skip = filters.skip ?? 0;
        const limit = filters.limit ?? 100;

        const [data, total] = await Promise.all([
            OptimizationRecommendation.find(query)
                .sort({ priority: 1, predicted_savings: -1, generated_at: -1 })
                .skip(skip)
                .limit(limit)
                .populate('resource', 'resource_name resource_type provider_type environment monthly_cost instance_type'),
            OptimizationRecommendation.countDocuments(query),
        ]);

        return { data, total, skip, limit };
    }

    static async getRecommendation(id: string) {
        return OptimizationRecommendation.findById(id)
            .populate('resource')
            .populate('waste_assessment');
    }

    static async updateStatus(id: string, status: string) {
        const allowed = ['pending', 'accepted', 'dismissed', 'implemented'];
        if (!allowed.includes(status.toLowerCase())) {
            throw new Error(`Invalid status "${status}". Allowed: ${allowed.join(', ')}`);
        }
        const doc = await OptimizationRecommendation.findByIdAndUpdate(
            id,
            { $set: { status: status.toLowerCase(), updated_at: new Date() } },
            { new: true }
        ).populate('resource');
        return doc;
    }

    static async getSummary(): Promise<RecommendationSummary> {
        const [pipeline, typeCounts] = await Promise.all([
            OptimizationRecommendation.aggregate([
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
                        accepted: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } },
                        dismissed: { $sum: { $cond: [{ $eq: ['$status', 'dismissed'] }, 1, 0] } },
                        implemented: { $sum: { $cond: [{ $eq: ['$status', 'implemented'] }, 1, 0] } },
                        totalSavings: { $sum: '$predicted_savings' },
                        critical: { $sum: { $cond: [{ $eq: ['$priority', 'CRITICAL'] }, 1, 0] } },
                        high: { $sum: { $cond: [{ $eq: ['$priority', 'HIGH'] }, 1, 0] } },
                        medium: { $sum: { $cond: [{ $eq: ['$priority', 'MEDIUM'] }, 1, 0] } },
                        low: { $sum: { $cond: [{ $eq: ['$priority', 'LOW'] }, 1, 0] } },
                    }
                }
            ]),
            OptimizationRecommendation.aggregate([
                { $group: { _id: '$recommendation_type', count: { $sum: 1 } } }
            ]),
        ]);

        const base = pipeline[0] ?? {
            total: 0, pending: 0, accepted: 0, dismissed: 0, implemented: 0,
            totalSavings: 0, critical: 0, high: 0, medium: 0, low: 0,
        };

        const typeMap: Record<string, number> = {};
        for (const row of typeCounts) typeMap[row._id] = row.count;

        return {
            totalRecommendations: base.total,
            pendingCount: base.pending,
            acceptedCount: base.accepted,
            dismissedCount: base.dismissed,
            implementedCount: base.implemented,
            estimatedTotalSavings: round2(base.totalSavings),
            priorityCounts: {
                CRITICAL: base.critical,
                HIGH: base.high,
                MEDIUM: base.medium,
                LOW: base.low,
            },
            typeCounts: typeMap,
        };
    }
}
