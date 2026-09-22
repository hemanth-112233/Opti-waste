import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OptimizationRecommendationService } from '../../../services/OptimizationRecommendationService';
import { WasteRiskAssessment } from '../../../models/WasteRiskAssessment';
import { CloudResource } from '../../../models/CloudResource';
import { ResourceMetric } from '../../../models/ResourceMetric';
import { CostRecord } from '../../../models/CostRecord';
import { OptimizationRecommendation } from '../../../models/OptimizationRecommendation';

describe('OptimizationRecommendationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates a critical idle recommendation for a high-risk production assessment', async () => {
    const assessment = {
      _id: 'wa-1',
      resource: 'r-1',
      risk_level: 'HIGH',
      confidence_score: 0.8,
      waste_categories: ['idle'],
    };
    const resource = {
      _id: 'r-1',
      resource_name: 'prod-idle',
      resource_type: 'EC2',
      instance_type: 'm5.large',
      environment: 'production',
      owner: 'ops',
      cpu: 8,
      memory: 32,
      storage: 200,
      monthly_cost: 500,
    };

    (WasteRiskAssessment as any).find.mockReturnValue({
      lean: vi.fn().mockResolvedValue([assessment]),
    });
    (CloudResource as any).find.mockReturnValue({
      lean: vi.fn().mockResolvedValue([resource]),
    });
    (ResourceMetric as any).aggregate.mockResolvedValue([
      {
        _id: 'r-1',
        avgCpu: 2,
        avgMemory: 4,
        avgStorage: 12,
        avgDiskRead: 0,
        avgDiskWrite: 0,
        sampleCount: 12,
        earliest: new Date('2026-09-01'),
        latest: new Date('2026-09-10'),
      },
    ]);
    (CostRecord as any).aggregate.mockResolvedValue([
      {
        _id: 'r-1',
        latestMonthly: 500,
        latestProjected: 650,
        avgDaily: 17,
        maxDaily: 19,
        hasFinalizedRecords: 1,
      },
    ]);
    (OptimizationRecommendation as any).findOneAndUpdate.mockResolvedValue({
      _id: 'rec-1',
      recommendation_type: 'idle',
      priority: 'CRITICAL',
      predicted_savings: 500,
    });

    const summary = await OptimizationRecommendationService.runGeneration();

    expect(summary.totalAssessmentsProcessed).toBe(1);
    expect(summary.totalRecommendationsGenerated).toBe(1);
    expect(summary.priorityCounts.CRITICAL).toBe(1);
    expect(summary.categoryCounts.idle).toBe(1);
    expect((OptimizationRecommendation as any).findOneAndUpdate).toHaveBeenCalledWith(
      { resource: 'r-1', recommendation_type: 'idle' },
      expect.objectContaining({
        $set: expect.objectContaining({
          resource: 'r-1',
          recommendation_type: 'idle',
          priority: 'CRITICAL',
          waste_assessment: 'wa-1',
        }),
      }),
      { upsert: true, new: true }
    );
  });

  it('updates a recommendation status to implemented and rejects invalid transitions', async () => {
    const populate = vi.fn().mockResolvedValue({ _id: 'rec-1', status: 'implemented' });
    (OptimizationRecommendation as any).findByIdAndUpdate.mockReturnValue({ populate });

    const result = await OptimizationRecommendationService.updateStatus('rec-1', 'Implemented');

    expect(result).not.toBeNull();
    expect(result!.status).toBe('implemented');
    expect((OptimizationRecommendation as any).findByIdAndUpdate).toHaveBeenCalledWith(
      'rec-1',
      { $set: { status: 'implemented', updated_at: expect.any(Date) } },
      { new: true }
    );

    await expect(OptimizationRecommendationService.updateStatus('rec-1', 'unknown')).rejects.toThrow('Invalid status');
  });

  it('returns a summary map with priorities and recommendation types', async () => {
    (OptimizationRecommendation as any).aggregate
      .mockResolvedValueOnce([
        {
          _id: null,
          total: 3,
          pending: 1,
          accepted: 1,
          dismissed: 0,
          implemented: 1,
          totalSavings: 250,
          critical: 1,
          high: 1,
          medium: 0,
          low: 1,
        },
      ])
      .mockResolvedValueOnce([
        { _id: 'idle', count: 2 },
        { _id: 'cost_anomaly', count: 1 },
      ]);

    const summary = await OptimizationRecommendationService.getSummary();

    expect(summary.totalRecommendations).toBe(3);
    expect(summary.pendingCount).toBe(1);
    expect(summary.acceptedCount).toBe(1);
    expect(summary.estimatedTotalSavings).toBe(250);
    expect(summary.priorityCounts.CRITICAL).toBe(1);
    expect(summary.typeCounts.idle).toBe(2);
  });
});

vi.mock('../../../models/WasteRiskAssessment', () => ({
  WasteRiskAssessment: {
    find: vi.fn(),
  },
}));

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

vi.mock('../../../models/OptimizationRecommendation', () => ({
  OptimizationRecommendation: {
    findOneAndUpdate: vi.fn(),
    findByIdAndUpdate: vi.fn(),
    aggregate: vi.fn(),
  },
}));
