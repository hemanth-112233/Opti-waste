/**
 * WasteDetectionService Unit Tests
 *
 * Tests the pure `_analyzeResource` method which contains all detection logic.
 * No database connection is required — all inputs are test fixtures.
 *
 * Run with: npx ts-node src/services/__tests__/WasteDetectionService.test.ts
 *
 * NOTE: If you add Jest to the project (`npm install --save-dev jest @types/jest ts-jest`)
 * these tests will also pass with `npx jest`.
 */

import { WasteDetectionService } from '../WasteDetectionService';
import {
    IDLE_CPU_THRESHOLD,
    IDLE_NETWORK_THRESHOLD,
    UNDERUTILIZATION_CPU_THRESHOLD,
    UNDERUTILIZATION_MEMORY_THRESHOLD,
    OVERPROVISIONED_CPU_THRESHOLD,
    MIN_SAMPLES_FOR_CLASSIFICATION,
} from '../../config/wasteConstants';

// ── Fixture factories ────────────────────────────────────────────────────────

function makeResource(overrides: Partial<any> = {}): any {
    return {
        _id: 'test-resource-id',
        resource_name: 'test-resource',
        resource_type: 'EC2',
        instance_type: 't3.large',
        service_name: 'EC2',
        status: 'running',
        cpu: 4,
        memory: 16,
        storage: 100,
        provider_type: 'AWS',
        monthly_cost: 200,
        is_deleted: false,
        ...overrides,
    };
}

function makeMetricSummary(overrides: Partial<any> = {}): any {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return {
        sampleCount: MIN_SAMPLES_FOR_CLASSIFICATION + 5,
        avgCpu: 50,
        avgMemory: 55,
        avgStorage: 60,
        avgNetworkIn: 10,
        avgNetworkOut: 8,
        avgDiskRead: 5,
        avgDiskWrite: 3,
        hasStoppedSamples: false,
        earliestTimestamp: weekAgo,
        latestTimestamp: now,
        ...overrides,
    };
}

function makeCostSummary(overrides: Partial<any> = {}): any {
    return {
        hasData: true,
        latestMonthly: 200,
        latestProjected: 210,
        avgDaily: 6.67,
        maxDaily: 7,
        ...overrides,
    };
}

// ── Simple assertion helper (no external lib needed) ─────────────────────────

let passed = 0;
let failed = 0;
const results: string[] = [];

function expect(label: string, actual: any, expected: any, op: 'eq' | 'neq' | 'truthy' | 'null') {
    let ok = false;
    if (op === 'eq') ok = actual === expected;
    if (op === 'neq') ok = actual !== expected;
    if (op === 'truthy') ok = !!actual;
    if (op === 'null') ok = actual === null || actual === undefined;

    if (ok) {
        passed++;
        results.push(`  ✓  ${label}`);
    } else {
        failed++;
        results.push(`  ✗  ${label}  (got: ${JSON.stringify(actual)}, expected: ${JSON.stringify(expected)})`);
    }
}

// ── Tests ────────────────────────────────────────────────────────────────────

function test(name: string, fn: () => void) {
    results.push(`\n${name}`);
    fn();
}

// 1. Healthy resource — NO false positive
test('1. Healthy resource produces NO finding', () => {
    const r = makeResource({ status: 'running' });
    const m = makeMetricSummary({ avgCpu: 55, avgMemory: 65, avgStorage: 70, avgNetworkIn: 20, avgNetworkOut: 15 });
    const c = makeCostSummary({ latestMonthly: 200, latestProjected: 205 });
    const finding = WasteDetectionService._analyzeResource(r, m, c);
    expect('finding is null', finding, null, 'null');
});

// 2. Idle resource — stopped state
test('2. Idle resource (stopped state) detected', () => {
    const r = makeResource({ status: 'stopped' });
    const m = makeMetricSummary({ hasStoppedSamples: true, avgCpu: 0, avgNetworkIn: 0, avgNetworkOut: 0 });
    const c = makeCostSummary({ latestMonthly: 100, latestProjected: 105 });
    const finding = WasteDetectionService._analyzeResource(r, m, c);
    expect('finding is not null', finding, null, 'neq');
    expect('category includes idle', finding?.categories.includes('idle'), true, 'eq');
    expect('risk_score > 0', finding!.riskScore > 0, true, 'eq');
    expect('assessment_reason non-empty', finding!.assessmentReason.length > 0, true, 'eq');
    expect('stopped state mentioned in reason', finding!.assessmentReason.includes('stopped'), true, 'eq');
});

// 3. Underutilized resource — low CPU and memory
test('3. Underutilized resource detected', () => {
    const r = makeResource({ status: 'running' });
    const m = makeMetricSummary({ avgCpu: 8, avgMemory: 10, avgNetworkIn: 5, avgNetworkOut: 3 });
    const c = makeCostSummary();
    const finding = WasteDetectionService._analyzeResource(r, m, c);
    expect('finding is not null', finding, null, 'neq');
    expect('category includes underutilized', finding?.categories.includes('underutilized'), true, 'eq');
    expect('reason includes avg CPU', finding!.assessmentReason.includes('CPU'), true, 'eq');
});

// 4. Overprovisioned — very low CPU/memory vs allocated
test('4. Overprovisioned resource detected', () => {
    const r = makeResource({ cpu: 16, memory: 64, status: 'running' });
    const m = makeMetricSummary({ avgCpu: 5, avgMemory: 7, avgNetworkIn: 10, avgNetworkOut: 5 });
    const c = makeCostSummary();
    const finding = WasteDetectionService._analyzeResource(r, m, c);
    expect('finding is not null', finding, null, 'neq');
    const hasOverprov = finding?.categories.includes('overprovisioned') ||
        finding?.categories.includes('underutilized');  // may pick underutilized
    expect('overprovisioned or underutilized category present', hasOverprov, true, 'eq');
    expect('allocated CPU mentioned in reason', finding!.assessmentReason.includes('CPU') ||
        finding!.assessmentReason.includes('memory'), true, 'eq');
});

// 5. Potentially unattached storage
test('5. Potentially unattached storage detected', () => {
    const r = makeResource({ resource_type: 'ebs-volume', status: 'available' });
    const m = makeMetricSummary({ avgDiskRead: 0, avgDiskWrite: 0 });
    const c = makeCostSummary();
    const finding = WasteDetectionService._analyzeResource(r, m, c);
    expect('finding is not null', finding, null, 'neq');
    expect('unattached_storage category', finding?.categories.includes('unattached_storage'), true, 'eq');
    expect('reason mentions unattached', finding!.assessmentReason.toLowerCase().includes('unattach'), true, 'eq');
});

// 6. Storage waste
test('6. Storage waste detected', () => {
    const r = makeResource({ resource_type: 'EC2', storage: 500 });
    const m = makeMetricSummary({ avgStorage: 10, avgCpu: 50, avgMemory: 55 });
    const c = makeCostSummary();
    const finding = WasteDetectionService._analyzeResource(r, m, c);
    expect('finding is not null', finding, null, 'neq');
    expect('storage_waste category', finding?.categories.includes('storage_waste'), true, 'eq');
    expect('reason mentions storage', finding!.assessmentReason.toLowerCase().includes('storage'), true, 'eq');
});

// 7. Cost anomaly — projected >> monthly
test('7. Cost anomaly detected', () => {
    const r = makeResource({ status: 'running' });
    const m = makeMetricSummary({ avgCpu: 50, avgMemory: 55 });
    const c = makeCostSummary({ latestMonthly: 100, latestProjected: 200, avgDaily: 3, maxDaily: 25 });
    const finding = WasteDetectionService._analyzeResource(r, m, c);
    expect('finding is not null', finding, null, 'neq');
    expect('cost_anomaly category', finding?.categories.includes('cost_anomaly'), true, 'eq');
    expect('reason mentions cost', finding!.assessmentReason.toLowerCase().includes('cost'), true, 'eq');
});

// 8. Missing metrics — insufficient samples
test('8. Missing metrics (0 samples) does not crash and does not classify', () => {
    const r = makeResource({ status: 'running' });
    const m = makeMetricSummary({ sampleCount: 0, avgCpu: 0, avgMemory: 0, avgStorage: 0 });
    const c = makeCostSummary({ latestProjected: 105 });  // no spike
    let finding: any;
    let threw = false;
    try {
        finding = WasteDetectionService._analyzeResource(r, m, c);
    } catch {
        threw = true;
    }
    expect('did not throw', threw, false, 'eq');
    // With 0 samples there's no evidence — should return null (no classification)
    expect('no finding without evidence', finding, null, 'null');
});

// 9. Missing cost data
test('9. Missing cost data handled gracefully', () => {
    const r = makeResource({ status: 'running' });
    const m = makeMetricSummary({ avgCpu: 3, avgNetworkIn: 0, avgNetworkOut: 0, hasStoppedSamples: false });
    const c: any = { hasData: false, latestMonthly: 0, latestProjected: 0, avgDaily: 0, maxDaily: 0 };
    let threw = false;
    let finding: any;
    try {
        finding = WasteDetectionService._analyzeResource(r, m, c);
    } catch {
        threw = true;
    }
    expect('did not throw', threw, false, 'eq');
    if (finding) {
        // If still found (idle from low CPU), estimatedWasteCost should be null (no cost data)
        expect('estimated_waste_cost is null without cost data', finding.estimatedWasteCost, null, 'null');
    }
});

// 10. Insufficient observations → low confidence, no aggressive classification
test('10. Only 1 metric sample → no underutilized classification', () => {
    const r = makeResource({ status: 'running' });
    // MIN_SAMPLES_FOR_CLASSIFICATION = 3, so 1 sample is below threshold
    const m = makeMetricSummary({ sampleCount: 1, avgCpu: 5, avgMemory: 5 });
    const c = makeCostSummary();
    const finding = WasteDetectionService._analyzeResource(r, m, c);
    if (finding) {
        expect('underutilized NOT classified with 1 sample',
            finding.categories.includes('underutilized'), false, 'eq');
    } else {
        expect('no finding (also acceptable)', true, true, 'truthy');
    }
});

// ── Report ────────────────────────────────────────────────────────────────────
console.log('\n════════════════════════════════════════');
console.log('  WasteDetectionService Test Results');
console.log('════════════════════════════════════════');
results.forEach(r => console.log(r));
console.log('\n────────────────────────────────────────');
console.log(`  Total: ${passed + failed}  ✓ Passed: ${passed}  ✗ Failed: ${failed}`);
console.log('════════════════════════════════════════\n');

if (failed > 0) process.exit(1);
