import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WasteDetectionService } from '../../../services/WasteDetectionService';
import { CloudResource } from '../../../models/CloudResource';
import { ResourceMetric } from '../../../models/ResourceMetric';
import { CostRecord } from '../../../models/CostRecord';
import { WasteRiskAssessment } from '../../../models/WasteRiskAssessment';
import { WasteAssessmentHistory } from '../../../models/WasteAssessmentHistory';
import {
  IDLE_CPU_THRESHOLD,
  IDLE_NETWORK_THRESHOLD,
  MIN_SAMPLES_FOR_CLASSIFICATION,
  STORAGE_WASTE_THRESHOLD,
  UNDERUTILIZATION_CPU_THRESHOLD,
  UNDERUTILIZATION_MEMORY_THRESHOLD,
  COST_PROJECTION_SPIKE_RATIO,
} from '../../../config/wasteConstants';

vi.mock('../../../models/CloudResource', () => ({
  CloudResource: {
    find: vi.fn(),
  },
}));

vi.mock('../../../models/ResourceMetric', () => ({
  ResourceMetric: {
    aggregate: vi.fn(),
  },
}));

vi.mock('../../../models/CostRecord', () => ({
  CostRecord: {
    aggregate: vi.fn(),
  },
}));

vi.mock('../../../models/WasteRiskAssessment', () => ({
  WasteRiskAssessment: {
    findOne: vi.fn(),
    create: vi.fn(),
    find: vi.fn(),
    aggregate: vi.fn(),
  },
}));

vi.mock('../../../models/WasteAssessmentHistory', () => ({
  WasteAssessmentHistory: {
    create: vi.fn(),
  },
}));

describe('WasteDetectionService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('detects an idle stopped resource using the actual idle logic', () => {
    const resource = {
      _id: 'r-1',
      resource_name: 'idle-vm',
      resource_type: 'EC2',
      status: 'stopped',
      cpu: 4,
      memory: 16,
      storage: 200,
      monthly_cost: 120,
    };
    const metrics = {
      sampleCount: MIN_SAMPLES_FOR_CLASSIFICATION,
      avgCpu: 0,
      avgMemory: 0,
      avgStorage: 0,
      avgNetworkIn: 0,
      avgNetworkOut: 0,
      avgDiskRead: 0,
      avgDiskWrite: 0,
      hasStoppedSamples: true,
      earliestTimestamp: new Date('2026-09-01'),
      latestTimestamp: new Date('2026-09-10'),
    };
    const costs = {
      hasData: true,
      latestMonthly: 120,
      latestProjected: 130,
      avgDaily: 4,
      maxDaily: 5,
    };

    const finding = WasteDetectionService._analyzeResource(resource, metrics, costs);

    expect(finding).not.toBeNull();
    expect(finding!.categories).toContain('idle');
    expect(finding!.riskLevel).toBe('CRITICAL');
    expect(finding!.estimatedWasteCost).toBe(120);
    expect(finding!.assessmentReason).toContain('stopped state');
  });

  it('detects a persistently underutilized resource using the configured thresholds', () => {
    const resource = {
      _id: 'r-2',
      resource_name: 'small-web',
      resource_type: 'EC2',
      status: 'running',
      cpu: 8,
      memory: 32,
      storage: 200,
      monthly_cost: 200,
    };
    const metrics = {
      sampleCount: 6,
      avgCpu: UNDERUTILIZATION_CPU_THRESHOLD - 5,
      avgMemory: UNDERUTILIZATION_MEMORY_THRESHOLD - 4,
      avgStorage: 35,
      avgNetworkIn: 0.5,
      avgNetworkOut: 0.4,
      avgDiskRead: 1,
      avgDiskWrite: 1,
      hasStoppedSamples: false,
      earliestTimestamp: new Date('2026-09-01'),
      latestTimestamp: new Date('2026-09-08'),
    };
    const costs = {
      hasData: true,
      latestMonthly: 200,
      latestProjected: 210,
      avgDaily: 6.7,
      maxDaily: 7,
    };

    const finding = WasteDetectionService._analyzeResource(resource, metrics, costs);

    expect(finding).not.toBeNull();
    expect(finding!.categories).toContain('underutilized');
    expect(finding!.riskScore).toBeGreaterThan(0);
    expect(finding!.assessmentReason).toContain('underutilized');
  });

  it('keeps overprovisioned independent detection behind the underutilization guard in the real implementation', () => {
    const resource = {
      _id: 'r-3',
      resource_name: 'over-sized',
      resource_type: 'EC2',
      status: 'running',
      cpu: 32,
      memory: 64,
      storage: 400,
      monthly_cost: 300,
    };
    const metrics = {
      sampleCount: 6,
      avgCpu: 18,
      avgMemory: 25,
      avgStorage: 45,
      avgNetworkIn: 1,
      avgNetworkOut: 1,
      avgDiskRead: 1,
      avgDiskWrite: 1,
      hasStoppedSamples: false,
      earliestTimestamp: new Date('2026-09-01'),
      latestTimestamp: new Date('2026-09-08'),
    };
    const costs = {
      hasData: true,
      latestMonthly: 300,
      latestProjected: 320,
      avgDaily: 10,
      maxDaily: 11,
    };

    const finding = WasteDetectionService._analyzeResource(resource, metrics, costs);

    expect(finding).not.toBeNull();
    expect(finding!.categories).toContain('underutilized');
    expect(finding!.categories).not.toContain('overprovisioned');
  });

  it('detects storage waste using the configured storage threshold', () => {
    const resource = {
      _id: 'r-4',
      resource_name: 'storage-heavy',
      resource_type: 'EC2',
      status: 'running',
      cpu: 8,
      memory: 32,
      storage: 500,
      monthly_cost: 250,
    };
    const metrics = {
      sampleCount: 6,
      avgCpu: 50,
      avgMemory: 45,
      avgStorage: STORAGE_WASTE_THRESHOLD - 10,
      avgNetworkIn: 5,
      avgNetworkOut: 4,
      avgDiskRead: 2,
      avgDiskWrite: 2,
      hasStoppedSamples: false,
      earliestTimestamp: new Date('2026-09-01'),
      latestTimestamp: new Date('2026-09-08'),
    };
    const costs = {
      hasData: true,
      latestMonthly: 250,
      latestProjected: 260,
      avgDaily: 8,
      maxDaily: 9,
    };

    const finding = WasteDetectionService._analyzeResource(resource, metrics, costs);

    expect(finding).not.toBeNull();
    expect(finding!.categories).toContain('storage_waste');
    expect(finding!.estimatedWasteCost).not.toBeNull();
    expect(finding!.assessmentReason).toContain('Storage waste');
  });

  it('detects cost anomaly when projected cost exceeds the configured ratio', () => {
    const resource = {
      _id: 'r-5',
      resource_name: 'spiky-resource',
      resource_type: 'EC2',
      status: 'running',
      cpu: 8,
      memory: 32,
      storage: 200,
      monthly_cost: 100,
    };
    const metrics = {
      sampleCount: 6,
      avgCpu: 50,
      avgMemory: 55,
      avgStorage: 60,
      avgNetworkIn: 10,
      avgNetworkOut: 8,
      avgDiskRead: 2,
      avgDiskWrite: 2,
      hasStoppedSamples: false,
      earliestTimestamp: new Date('2026-09-01'),
      latestTimestamp: new Date('2026-09-08'),
    };
    const costs = {
      hasData: true,
      latestMonthly: 100,
      latestProjected: 100 * COST_PROJECTION_SPIKE_RATIO + 10,
      avgDaily: 3,
      maxDaily: 25,
    };

    const finding = WasteDetectionService._analyzeResource(resource, metrics, costs);

    expect(finding).not.toBeNull();
    expect(finding!.categories).toContain('cost_anomaly');
    expect(finding!.assessmentReason).toContain('Cost anomaly');
  });

  it('persists a risk finding and records score history changes when the score moves materially', async () => {
    const resourceId = 'r-6';
    const finding = {
      resourceId,
      categories: ['idle'],
      riskScore: 70,
      riskLevel: 'HIGH',
      confidenceScore: 0.7,
      assessmentReason: 'idle resource',
      estimatedWasteCost: 200,
    };

    (WasteRiskAssessment as any).findOne.mockResolvedValue({
      risk_score: 10,
      save: vi.fn().mockResolvedValue(true),
    });

    await WasteDetectionService._persistFinding(resourceId, finding as any);

    expect((WasteRiskAssessment as any).findOne).toHaveBeenCalledWith({ resource: resourceId });
    expect((WasteAssessmentHistory as any).create).toHaveBeenCalledWith(expect.objectContaining({
      resource: resourceId,
      previous_score: 10,
      current_score: 70,
      risk_level: 'HIGH',
    }));
  });

  it('returns the aggregate runAnalysis summary and persists findings', async () => {
    const resourceA = { _id: 'r-a', resource_name: 'a', resource_type: 'EC2', status: 'stopped', cpu: 4, memory: 16, storage: 200, monthly_cost: 120, is_deleted: false };
    const resourceB = { _id: 'r-b', resource_name: 'b', resource_type: 'EC2', status: 'running', cpu: 8, memory: 32, storage: 200, monthly_cost: 140, is_deleted: false };

    (CloudResource as any).find.mockReturnValue({
      lean: vi.fn().mockResolvedValue([resourceA, resourceB]),
    });
    (ResourceMetric as any).aggregate.mockResolvedValue([
      {
        _id: 'r-a',
        sampleCount: 6,
        avgCpu: 0,
        avgMemory: 0,
        avgStorage: 0,
        avgNetworkIn: 0,
        avgNetworkOut: 0,
        avgDiskRead: 0,
        avgDiskWrite: 0,
        hasStoppedSamples: 1,
        earliest: new Date('2026-09-01'),
        latest: new Date('2026-09-06'),
      },
      {
        _id: 'r-b',
        sampleCount: 6,
        avgCpu: 50,
        avgMemory: 50,
        avgStorage: 60,
        avgNetworkIn: 10,
        avgNetworkOut: 8,
        avgDiskRead: 2,
        avgDiskWrite: 2,
        hasStoppedSamples: 0,
        earliest: new Date('2026-09-01'),
        latest: new Date('2026-09-06'),
      },
    ]);
    (CostRecord as any).aggregate.mockResolvedValue([
      { _id: 'r-a', latestMonthly: 120, latestProjected: 130, avgDaily: 4, maxDaily: 5 },
      { _id: 'r-b', latestMonthly: 140, latestProjected: 145, avgDaily: 5, maxDaily: 6 },
    ]);
    (WasteRiskAssessment as any).findOne.mockResolvedValue(null);
    (WasteRiskAssessment as any).create.mockResolvedValue({});

    const summary = await WasteDetectionService.runAnalysis();

    expect(summary.totalResourcesAnalyzed).toBe(2);
    expect(summary.totalFindings).toBeGreaterThan(0);
    expect(summary.estimatedWasteCost).toBeGreaterThan(0);
    expect(summary.categoryCounts.idle).toBeGreaterThanOrEqual(1);
    expect((WasteRiskAssessment as any).create).toHaveBeenCalled();
  });
});
