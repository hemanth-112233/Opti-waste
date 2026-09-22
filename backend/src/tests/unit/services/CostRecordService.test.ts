import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CostRecordService } from '../../../services/CostRecordService';
import { CostRecord } from '../../../models/CostRecord';
import { CloudResource } from '../../../models/CloudResource';
import { CloudProvider } from '../../../models/CloudProvider';
import { AuditLog } from '../../../models/AuditLog';

vi.mock('../../../models/CostRecord', () => ({
  CostRecord: Object.assign(
    function CostRecordMock(this: any, data: any) {
      Object.assign(this, data);
      this.save = vi.fn().mockResolvedValue(this);
    },
    {
      find: vi.fn(),
      findById: vi.fn(),
      findByIdAndDelete: vi.fn(),
      aggregate: vi.fn(),
    }
  ),
}));

vi.mock('../../../models/CloudResource', () => ({
  CloudResource: { findById: vi.fn() },
}));

vi.mock('../../../models/CloudProvider', () => ({
  CloudProvider: { findById: vi.fn() },
}));

vi.mock('../../../models/AuditLog', () => ({
  AuditLog: { create: vi.fn() },
}));

describe('CostRecordService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a cost record for a valid resource and provider', async () => {
    const resource = { _id: 'resource-1', resource_name: 'web-01' };
    const provider = { _id: 'provider-1', provider_name: 'AWS Main' };
    const payload = {
      resource_id: 'resource-1',
      provider_id: 'provider-1',
      billing_period: '2026-09',
      daily_cost: 10,
      weekly_cost: 70,
      monthly_cost: 300,
      projected_monthly_cost: 320,
      cost_timestamp: new Date('2026-09-22'),
    };

    (CloudResource as any).findById.mockResolvedValue(resource);
    (CloudProvider as any).findById.mockResolvedValue(provider);

    const result = await CostRecordService.createCost(payload, 'user-1');

    expect(result).toMatchObject({
      resource: resource._id,
      provider: provider._id,
      resource_id: 'resource-1',
      provider_id: 'provider-1',
    });
    expect((AuditLog as any).create).toHaveBeenCalledWith({
      user_id: 'user-1',
      action: 'Cost Created',
      resource_type: 'Costs',
      description: 'Created cost record for resource web-01',
    });
  });

  it('throws when any cost field is negative', async () => {
    await expect(CostRecordService.createCost({
      resource_id: 'resource-1',
      provider_id: 'provider-1',
      billing_period: '2026-09',
      daily_cost: -1,
      weekly_cost: 50,
      monthly_cost: 300,
      projected_monthly_cost: 320,
    }, 'user-1')).rejects.toThrow('Costs must be positive values.');
  });

  it('throws when the resource is missing', async () => {
    (CloudResource as any).findById.mockResolvedValue(null);

    await expect(CostRecordService.createCost({
      resource_id: 'missing',
      provider_id: 'provider-1',
      billing_period: '2026-09',
      daily_cost: 10,
      weekly_cost: 70,
      monthly_cost: 300,
      projected_monthly_cost: 320,
    }, 'user-1')).rejects.toThrow('Cloud Resource not found.');
  });

  it('gets a filtered list of cost records', async () => {
    const populateMock = vi.fn().mockResolvedValue([{ _id: 'cost-1' }]);
    const sortMock = vi.fn().mockReturnThis();
    const skipMock = vi.fn().mockReturnThis();
    const limitMock = vi.fn().mockReturnThis();

    (CostRecord as any).find.mockReturnValue({ sort: sortMock, skip: skipMock, limit: limitMock, populate: populateMock });
    sortMock.mockReturnValue({ skip: skipMock, limit: limitMock, populate: populateMock });
    skipMock.mockReturnValue({ limit: limitMock, populate: populateMock });
    limitMock.mockReturnValue({ populate: populateMock });

    const result = await CostRecordService.getCosts(0, 25, 'resource-1', 'provider-1', '2026-09');

    expect(result).toEqual([{ _id: 'cost-1' }]);
    expect((CostRecord as any).find).toHaveBeenCalledWith({
      resource: 'resource-1',
      provider: 'provider-1',
      billing_period: '2026-09',
    });
  });

  it('returns null when updateCost targets a missing cost record', async () => {
    (CostRecord as any).findById.mockResolvedValue(null);

    const result = await CostRecordService.updateCost('missing', { daily_cost: 100 }, 'user-1');

    expect(result).toBeNull();
  });

  it('refuses negative values during cost updates', async () => {
    const existing = { _id: 'cost-1', daily_cost: 20, save: vi.fn() };
    (CostRecord as any).findById.mockResolvedValue(existing);

    await expect(CostRecordService.updateCost('cost-1', { daily_cost: -5 }, 'user-1')).rejects.toThrow('Costs must be positive values.');
  });

  it('deletes a cost record and logs the action', async () => {
    (CostRecord as any).findByIdAndDelete.mockResolvedValue({ _id: 'cost-1' });

    const result = await CostRecordService.deleteCost('cost-1', 'user-1');

    expect(result).toBe(true);
    expect((AuditLog as any).create).toHaveBeenCalledWith({
      user_id: 'user-1',
      action: 'Cost Deleted',
      resource_type: 'Costs',
      description: 'Deleted cost cost-1',
    });
  });

  it('builds the dashboard summary aggregation result', async () => {
    (CostRecord as any).aggregate
      .mockResolvedValueOnce([{ _id: null, total_daily: 100, total_monthly: 300, total_projected: 350, avg_cost: 150 }])
      .mockResolvedValueOnce([{ _id: 'provider-1', provider_total: 200 }]);

    const sortMock = vi.fn().mockReturnThis();
    const limitMock = vi.fn().mockReturnThis();
    const populateMock = vi.fn().mockResolvedValue([
      { _id: 'cost-1', monthly_cost: 300, resource: { resource_name: 'web-01' } }
    ]);
    (CostRecord as any).find.mockReturnValue({ sort: sortMock, limit: limitMock, populate: populateMock });
    sortMock.mockReturnValue({ limit: limitMock, populate: populateMock });
    limitMock.mockReturnValue({ populate: populateMock });

    const result = await CostRecordService.getDashboardSummary();

    expect(result).toMatchObject({
      total_daily_cost: 100,
      total_monthly_cost: 300,
      projected_cost: 350,
      average_resource_cost: 150,
    });
    expect(result.cost_by_provider).toEqual([{ _id: 'provider-1', provider_total: 200 }]);
  });
});
