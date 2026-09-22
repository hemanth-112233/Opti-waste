import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ResourceMetricService } from '../../../services/ResourceMetricService';
import { ResourceMetric } from '../../../models/ResourceMetric';
import { CloudResource } from '../../../models/CloudResource';
import { AuditLog } from '../../../models/AuditLog';

vi.mock('../../../models/ResourceMetric', () => ({
  ResourceMetric: Object.assign(
    function ResourceMetricMock(this: any, data: any) {
      Object.assign(this, data);
      this.save = vi.fn().mockResolvedValue(this);
    },
    {
      find: vi.fn(),
      findOne: vi.fn(),
      countDocuments: vi.fn(),
      findById: vi.fn(),
      findByIdAndDelete: vi.fn(),
      aggregate: vi.fn(),
    }
  ),
}));

vi.mock('../../../models/CloudResource', () => ({
  CloudResource: { findOne: vi.fn() },
}));

vi.mock('../../../models/AuditLog', () => ({
  AuditLog: { create: vi.fn() },
}));

describe('ResourceMetricService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a metric when the utilization values are valid and the resource exists', async () => {
    const resource = { _id: 'resource-1', resource_name: 'web-01', is_deleted: false };
    const payload = {
      resource_id: 'resource-1',
      cpu_utilization: 35,
      memory_utilization: 40,
      storage_utilization: 30,
      network_in: 10,
      network_out: 8,
      disk_read: 5,
      disk_write: 6,
      metric_timestamp: new Date('2026-09-22'),
    };

    (CloudResource as any).findOne.mockResolvedValue(resource);
    (ResourceMetric as any).findOne.mockResolvedValue(null);

    const result = await ResourceMetricService.createMetric(payload, 'user-1');

    expect(result).toMatchObject({
      resource_id: 'resource-1',
      cpu_utilization: 35,
      memory_utilization: 40,
      storage_utilization: 30,
    });
    expect((AuditLog as any).create).toHaveBeenCalledWith({
      user_id: 'user-1',
      action: 'CREATE',
      resource_type: 'ResourceMetric',
      description: expect.stringMatching(/^Metric logged for web-01 mapped under [^\s]+$/),
    });
  });

  it('throws when a utilization metric is outside the expected 0..100 range', async () => {
    await expect(ResourceMetricService.createMetric({
      resource_id: 'resource-1',
      cpu_utilization: 120,
      memory_utilization: 50,
      storage_utilization: 10,
    }, 'user-1')).rejects.toThrow('Utilization metrics must be between 0 and 100.');
  });

  it('throws when the resource is missing or deleted', async () => {
    (CloudResource as any).findOne.mockResolvedValue(null);

    await expect(ResourceMetricService.createMetric({
      resource_id: 'missing-resource',
      cpu_utilization: 30,
      memory_utilization: 50,
      storage_utilization: 40,
    }, 'user-1')).rejects.toThrow('Cloud Resource not found or is deleted.');
  });

  it('rejects duplicate metrics for the same resource and timestamp', async () => {
    (CloudResource as any).findOne.mockResolvedValue({ _id: 'resource-1', is_deleted: false });
    (ResourceMetric as any).findOne.mockResolvedValue({ _id: 'metric-1' });

    await expect(ResourceMetricService.createMetric({
      resource_id: 'resource-1',
      cpu_utilization: 25,
      memory_utilization: 25,
      storage_utilization: 25,
      metric_timestamp: new Date('2026-09-22'),
    }, 'user-1')).rejects.toThrow('A metric entry for this timestamp already exists.');
  });

  it('returns paginated metrics from the resource metric collection', async () => {
    const sortMock = vi.fn().mockReturnThis();
    const skipMock = vi.fn().mockReturnThis();
    const limitMock = vi.fn().mockReturnThis();
    const populateMock = vi.fn().mockResolvedValue([{ _id: 'metric-1' }]);

    (ResourceMetric as any).find.mockReturnValue({ sort: sortMock, skip: skipMock, limit: limitMock });
    sortMock.mockReturnValue({ skip: skipMock, limit: limitMock });
    skipMock.mockReturnValue({ limit: limitMock });
    limitMock.mockReturnValue({ populate: populateMock });
    (ResourceMetric as any).countDocuments.mockResolvedValue(1);

    const result = await ResourceMetricService.getMetrics(0, 10, 'resource-1');

    expect(result).toEqual({ data: [{ _id: 'metric-1' }], total: 1, skip: 0, limit: 10 });
    expect((ResourceMetric as any).find).toHaveBeenCalledWith({ resource_id: 'resource-1' });
  });

  it('returns null when updateMetric targets a missing metric record', async () => {
    (ResourceMetric as any).findById.mockResolvedValue(null);

    const result = await ResourceMetricService.updateMetric('missing', { cpu_utilization: 50 }, 'user-1');

    expect(result).toBeNull();
  });

  it('rejects invalid values during metric updates', async () => {
    (ResourceMetric as any).findById.mockResolvedValue({ _id: 'metric-1', save: vi.fn() });

    await expect(ResourceMetricService.updateMetric('metric-1', { cpu_utilization: 150 }, 'user-1')).rejects.toThrow('cpu_utilization must be between 0 and 100.');
  });

  it('deletes a metric record and logs its removal', async () => {
    (ResourceMetric as any).findByIdAndDelete.mockResolvedValue({ _id: 'metric-1' });

    const result = await ResourceMetricService.deleteMetric('metric-1', 'user-1');

    expect(result).toBe(true);
    expect((AuditLog as any).create).toHaveBeenCalledWith({
      user_id: 'user-1',
      action: 'DELETE',
      resource_type: 'ResourceMetric',
      description: 'Hard deleted internal trace metric-1',
    });
  });

  it('returns the metric dashboard summary', async () => {
    (ResourceMetric as any).aggregate.mockResolvedValue([{ _id: null, avg_cpu: 45, avg_memory: 50, avg_storage: 35, avg_network_in: 10, avg_network_out: 8, total_records: 12 }]);
    (ResourceMetric as any).countDocuments.mockResolvedValue(4);

    const result = await ResourceMetricService.getDashboardSummary();

    expect(result).toMatchObject({
      average_cpu_utilization: 45,
      average_memory_utilization: 50,
      average_storage_utilization: 35,
      average_network_in: 10,
      average_network_out: 8,
      total_historical_metrics: 12,
      active_metrics_last_7_days: 4,
    });
  });
});
