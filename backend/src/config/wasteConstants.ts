/**
 * OptiWaste — Phase 18 Cloud Waste Detection Engine
 * Centralized thresholds and configuration constants.
 * All waste detection rules must reference these constants — do not scatter magic numbers.
 */

// ── Utilization thresholds ────────────────────────────────────────────────
/** CPU % below which a resource is considered underutilized */
export const UNDERUTILIZATION_CPU_THRESHOLD = 20;
/** Memory % below which a resource is considered underutilized */
export const UNDERUTILIZATION_MEMORY_THRESHOLD = 20;
/** CPU % below which a resource is considered idle (stricter) */
export const IDLE_CPU_THRESHOLD = 5;
/** Network bytes/s below which traffic is considered near-zero */
export const IDLE_NETWORK_THRESHOLD = 1;   // Mbps equivalent of near-zero
/** Storage % below which capacity is considered wasted */
export const STORAGE_WASTE_THRESHOLD = 30;
/** CPU % when allocated capacity vastly exceeds usage (overprovisioned) */
export const OVERPROVISIONED_CPU_THRESHOLD = 15;
/** Memory % when allocated capacity vastly exceeds usage */
export const OVERPROVISIONED_MEMORY_THRESHOLD = 15;

// ── Observation minimums ─────────────────────────────────────────────────
/** Minimum number of metric samples to make any classification */
export const MIN_SAMPLES_FOR_CLASSIFICATION = 3;
/** Minimum samples for high-confidence underutilization verdict */
export const MIN_SAMPLES_HIGH_CONFIDENCE = 24;   // ~1 sample/hr for a day
/** Minimum samples for medium-confidence verdict */
export const MIN_SAMPLES_MEDIUM_CONFIDENCE = 6;
/** Days of history to prefer for analysis */
export const OBSERVATION_WINDOW_DAYS = 7;

// ── Cost anomaly thresholds ───────────────────────────────────────────────
/** If projected_monthly_cost exceeds monthly_cost by this ratio, flag anomaly */
export const COST_PROJECTION_SPIKE_RATIO = 1.5;   // 50 % above current
/** Minimum daily cost deviation ratio to trigger anomaly from baseline */
export const COST_DAILY_SPIKE_RATIO = 2.0;         // 2× the baseline daily cost

// ── Risk score bands → risk level ────────────────────────────────────────
export const RISK_LEVEL_THRESHOLDS = {
    LOW: { min: 0, max: 24, label: 'LOW' },
    MEDIUM: { min: 25, max: 49, label: 'MEDIUM' },
    HIGH: { min: 50, max: 74, label: 'HIGH' },
    CRITICAL: { min: 75, max: 100, label: 'CRITICAL' },
} as const;

export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/** Map a numeric risk score (0–100) to a risk level label */
export function getRiskLevel(score: number): RiskLevel {
    if (score >= RISK_LEVEL_THRESHOLDS.CRITICAL.min) return 'CRITICAL';
    if (score >= RISK_LEVEL_THRESHOLDS.HIGH.min) return 'HIGH';
    if (score >= RISK_LEVEL_THRESHOLDS.MEDIUM.min) return 'MEDIUM';
    return 'LOW';
}

// ── Waste categories ──────────────────────────────────────────────────────
export const WASTE_CATEGORIES = [
    'idle',
    'underutilized',
    'overprovisioned',
    'unattached_storage',
    'storage_waste',
    'cost_anomaly',
] as const;

export type WasteCategory = typeof WASTE_CATEGORIES[number];
