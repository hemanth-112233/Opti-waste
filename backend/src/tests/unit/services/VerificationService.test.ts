import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VerificationService } from '../../../services/VerificationService';
import { OptimizationRecommendation } from '../../../models/OptimizationRecommendation';
import { RecommendationVerification } from '../../../models/RecommendationVerification';
import { RecommendationHistory } from '../../../models/RecommendationHistory';
import { ClosedLoopFeedback } from '../../../models/ClosedLoopFeedback';
import { SavingsAnalytics } from '../../../models/SavingsAnalytics';
import { CostRecord } from '../../../models/CostRecord';

describe('VerificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('verifies an implemented recommendation when baseline and post-implementation costs are sufficient', async () => {
    const recommendation = {
      _id: 'rec-1',
      resource: 'r-1',
      recommendation_type: 'idle',
      predicted_savings: 100,
      status: 'implemented',
      generated_at: new Date('2026-08-01'),
    };

    (OptimizationRecommendation as any).find.mockReturnValue({
      lean: vi.fn().mockResolvedValue([recommendation]),
    });
    (RecommendationHistory as any).findOne.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ implemented_at: new Date('2026-08-10') }),
      }),
    });

    (CostRecord as any).find
      .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([
        { monthly_cost: 100, daily_cost: 3.3, cost_timestamp: new Date('2026-08-01') },
        { monthly_cost: 100, daily_cost: 3.3, cost_timestamp: new Date('2026-08-02') },
        { monthly_cost: 100, daily_cost: 3.3, cost_timestamp: new Date('2026-08-03') },
      ]) })
      .mockReturnValueOnce({ lean: vi.fn().mockResolvedValue([
        { monthly_cost: 10, daily_cost: 0.3, cost_timestamp: new Date('2026-08-11') },
        { monthly_cost: 10, daily_cost: 0.3, cost_timestamp: new Date('2026-08-12') },
        { monthly_cost: 10, daily_cost: 0.3, cost_timestamp: new Date('2026-08-13') },
      ]) });

    (RecommendationVerification as any).findOneAndUpdate.mockResolvedValue({ _id: 'ver-1' });
    (ClosedLoopFeedback as any).findOneAndUpdate.mockResolvedValue({ _id: 'feedback-1' });
    (SavingsAnalytics as any).findOneAndUpdate.mockResolvedValue({ _id: 'analytics-1' });

    const summary = await VerificationService.runVerification();

    expect(summary.totalProcessed).toBe(1);
    expect(summary.verified).toBe(1);
    expect((RecommendationVerification as any).findOneAndUpdate).toHaveBeenCalledWith(
      { recommendation: 'rec-1' },
      expect.objectContaining({
        $set: expect.objectContaining({
          recommendation: 'rec-1',
          verification_status: 'verified',
          predicted_savings: 100,
          actual_savings: 90,
        }),
      }),
      { upsert: true, new: true }
    );
    expect((ClosedLoopFeedback as any).findOneAndUpdate).toHaveBeenCalled();
    expect((SavingsAnalytics as any).findOneAndUpdate).toHaveBeenCalled();
  });

  it('marks a recommendation as not verifiable when there are too few samples to establish a baseline or post-implementation window', async () => {
    (OptimizationRecommendation as any).find.mockReturnValue({
      lean: vi.fn().mockResolvedValue([{ _id: 'rec-2', resource: 'r-2', recommendation_type: 'underutilized', predicted_savings: 80, status: 'implemented', generated_at: new Date('2026-08-01') }]),
    });
    (RecommendationHistory as any).findOne.mockReturnValue({
      sort: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ implemented_at: new Date('2026-08-10') }),
      }),
    });
    (CostRecord as any).find.mockReturnValue({ lean: vi.fn().mockResolvedValue([]) });

    const summary = await VerificationService.runVerification();

    expect(summary.notVerifiable).toBe(1);
    expect((RecommendationVerification as any).findOneAndUpdate).toHaveBeenCalledWith(
      { recommendation: 'rec-2' },
      expect.objectContaining({
        $set: expect.objectContaining({ verification_status: 'not_verifiable' }),
      }),
      { upsert: true, new: true }
    );
    expect((ClosedLoopFeedback as any).findOneAndUpdate).not.toHaveBeenCalled();
  });

  it('filters verifications by status and recommendation and returns pagination metadata', async () => {
    const sort = vi.fn().mockReturnThis();
    const skip = vi.fn().mockReturnThis();
    const limit = vi.fn().mockReturnThis();
    const populate = vi.fn().mockResolvedValue([{ _id: 'ver-1' }]);

    (RecommendationVerification as any).find.mockReturnValue({ sort, skip, limit, populate });
    (RecommendationVerification as any).countDocuments.mockResolvedValue(1);

    const result = await VerificationService.getVerifications({
      status: 'verified',
      recommendation: 'rec-1',
      skip: 0,
      limit: 10,
    });

    expect(result.total).toBe(1);
    expect(result.data).toEqual([{ _id: 'ver-1' }]);
    expect((RecommendationVerification as any).find).toHaveBeenCalledWith({ verification_status: 'verified', recommendation: 'rec-1' });
  });

  it('returns the verification summary totals and average prediction error', async () => {
    (RecommendationVerification as any).aggregate
      .mockResolvedValueOnce([
        {
          _id: null,
          total: 3,
          verified: 1,
          partial: 1,
          failed: 1,
          notVerifiable: 0,
          pending: 0,
          totalConfirmed: 120,
          totalPredicted: 300,
        },
      ])
      .mockResolvedValueOnce([{ _id: null, avgError: 15 }]);

    const summary = await VerificationService.getSummary();

    expect(summary.totalVerifications).toBe(3);
    expect(summary.verifiedCount).toBe(1);
    expect(summary.partiallyVerifiedCount).toBe(1);
    expect(summary.failedCount).toBe(1);
    expect(summary.avgPredictionErrorPct).toBe(15);
    expect(summary.totalConfirmedSavings).toBe(120);
  });
});

vi.mock('../../../models/OptimizationRecommendation', () => ({
  OptimizationRecommendation: {
    find: vi.fn(),
  },
}));

vi.mock('../../../models/RecommendationVerification', () => ({
  RecommendationVerification: {
    findOneAndUpdate: vi.fn(),
    find: vi.fn(),
    countDocuments: vi.fn(),
    aggregate: vi.fn(),
    findById: vi.fn(),
  },
}));

vi.mock('../../../models/RecommendationHistory', () => ({
  RecommendationHistory: {
    findOne: vi.fn(),
  },
}));

vi.mock('../../../models/ClosedLoopFeedback', () => ({
  ClosedLoopFeedback: {
    findOneAndUpdate: vi.fn(),
  },
}));

vi.mock('../../../models/SavingsAnalytics', () => ({
  SavingsAnalytics: {
    findOneAndUpdate: vi.fn(),
  },
}));

vi.mock('../../../models/CostRecord', () => ({
  CostRecord: {
    find: vi.fn(),
  },
}));
