import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CostService } from '../../../services/CostService';
import { CostRecord } from '../../../models/CostRecord';
import { CloudResource } from '../../../models/CloudResource';
import { CloudProvider } from '../../../models/CloudProvider';
import { AuditLog } from '../../../models/AuditLog';

vi.mock('../../../models/CostRecord', () => ({
  CostRecord: Object.assign(
    function CostRecordMock(this: any, data: any) {
      Object.assign(this, data);
    },
    {
      create: vi.fn(),
      find: vi.fn(),
      findById: vi.fn(),
      findByIdAndUpdate: vi.fn(),
      findByIdAndDelete: vi.fn(),
      countDocuments: vi.fn(),
      aggregate: vi.fn(),
      findOne: vi.fn(),
    }
  ),
}));

vi.mock('../../../models/CloudResource', () => ({
  CloudResource: { findOne: vi.fn() },
}));

vi.mock('../../../models/CloudProvider', () => ({
  CloudProvider: { findOne: vi.fn() },
}));

vi.mock('../../../models/AuditLog', () => ({
  AuditLog: { create: vi.fn() },
}));

describe('CostService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a cost record when the resource and provider are valid and no duplicate exists', async () => {
    const resource = { _id: 'resource-1', resource_name: 'web-01', provider_id: 'provider-1', is_deleted: false };
    const provider = { _id: 'provider-1', provider_name: 'AWS Main', is_deleted: false };
    const created = { _id: 'cost-1', resource_id: 'resource-1', daily_cost: 20, monthly_cost: 600 };

    (CloudResource as any).findOne.mockResolvedValue(resource);
    (CloudProvider as any).findOne.mockResolvedValue(provider);
    (CostRecord as any).findOne.mockResolvedValue(null);
    (CostRecord as any).create.mockResolvedValue(created);

    const result = await CostService.createCostRecord({
      resource_id: 'resource-1',
      cost_timestamp: new Date('2026-09-22'),
      daily_cost: 20,
      monthly_cost: 600,
      projected_monthly_cost: 700,
      billing_period: '2026-09',
    }, 'user-1');

    expect(result).toEqual(created);
    expect((CostRecord as any).create).toHaveBeenCalledWith(expect.objectContaining({
      resource_id: 'resource-1',
      provider_id: 'provider-1',
      monthly_cost: 600,
    }));
    expect((AuditLog as any).create).toHaveBeenCalledWith({
      user_id: 'user-1',
      action: 'CREATE',
      resource_type: 'CostRecord',
      description: 'Logged Cost Record cost-1',
    });
  });

  it('throws when the resource is missing or deleted', async () => {
    (CloudResource as any).findOne.mockResolvedValue(null);

    await expect(CostService.createCostRecord({
      resource_id: 'missing',
      daily_cost: 3,
      monthly_cost: 90,
      projected_monthly_cost: 100,
    }, 'user-1')).rejects.toThrow('Cloud Resource not found or is deleted.');
  });

  it('throws when the duplicate timestamp already exists for the same resource', async () => {
    (CloudResource as any).findOne.mockResolvedValue({ _id: 'resource-1', provider_id: 'provider-1', is_deleted: false });
    (CloudProvider as any).findOne.mockResolvedValue({ _id: 'provider-1', is_deleted: false });
    (CostRecord as any).findOne.mockResolvedValue({ _id: 'existing' });

    await expect(CostService.createCostRecord({
      resource_id: 'resource-1',
      cost_timestamp: new Date('2026-09-22'),
      daily_cost: 10,
      monthly_cost: 300,
      projected_monthly_cost: 330,
    }, 'user-1')).rejects.toThrow('A cost record for this resource and timestamp already exists.');
  });

  it('lists cost records with pagination and filtering', async () => {
    const sortMock = vi.fn().mockReturnThis();
    const skipMock = vi.fn().mockReturnThis();
    const limitMock = vi.fn().mockReturnThis();
    const populate1 = vi.fn().mockReturnThis();
    const populate2 = vi.fn().mockReturnThis();
    const data = [{ _id: 'cost-1' }];

    (CostRecord as any).find.mockReturnValue({ sort: sortMock, skip: skipMock, limit: limitMock });
    sortMock.mockReturnValue({ skip: skipMock, limit: limitMock });
    skipMock.mockReturnValue({ limit: limitMock });
    limitMock.mockReturnValue({ populate: populate1 });
    populate1.mockReturnValue({ populate: populate2 });
    populate2.mockResolvedValue(data);
    (CostRecord as any).countDocuments.mockResolvedValue(1);

    const result = await CostService.getCostRecords(0, 20, 'resource-1', 'provider-1');

    expect(result).toEqual({ data, total: 1, skip: 0, limit: 20 });
    expect((CostRecord as any).find).toHaveBeenCalledWith({ resource_id: 'resource-1', provider_id: 'provider-1' });
  });

  it('rejects negative daily cost updates', async () => {
    await expect(CostService.updateCostRecord('cost-1', { daily_cost: -1 }, 'user-1')).rejects.toThrow('Cost cannot be negative.');
  });

  it('returns false when deleting a missing cost record', async () => {
    (CostRecord as any).findByIdAndDelete.mockResolvedValue(null);

    const result = await CostService.deleteCostRecord('missing', 'user-1');

    expect(result).toBe(false);
  });

  it('returns dashboard summary fields and provider distribution', async () => {
    (CostRecord as any).aggregate
      .mockResolvedValueOnce([{ _id: null, total_daily: 100, total_monthly: 500, total_yearly: 6000, total_projected: 700 }])
      .mockResolvedValueOnce([{ _id: 'AWS', total: 400 }])
      .mockResolvedValueOnce([{ _id: 'resource-1', resource_name: 'web-01', provider_type: 'AWS', total_cost: 250 }]);

    const result = await CostService.getDashboardSummary();

    expect(result.summary).toMatchObject({
      total_cloud_spend: 500,
      daily_spend: 100,
      total_monthly_spend: 500,
      total_yearly_spend: 6000,
      estimated_spend: 700,
    });
    expect(result.provider_distribution).toEqual({ AWS: 400 });
    expect(result.top_expensive_resources[0]).toMatchObject({ resource_name: 'web-01', total_cost: 250 });
  });

  it('returns cost trends grouped by date for the requested trailing days', async () => {
    (CostRecord as any).aggregate.mockResolvedValue([
      { _id: '2026-09-20', total_daily: 50 },
      { _id: '2026-09-21', total_daily: 60 },
    ]);

    const result = await CostService.getCostTrends(7);

    expect(result).toEqual([
      { date: '2026-09-20', cost: 50 },
      { date: '2026-09-21', cost: 60 },
    ]);
  });
});
