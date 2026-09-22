import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CloudResourceService } from '../../../services/CloudResourceService';
import { CloudResource } from '../../../models/CloudResource';
import { CloudProvider } from '../../../models/CloudProvider';
import { AuditLog } from '../../../models/AuditLog';

const mockCloudResourceCtor = vi.hoisted(() => {
  const save = vi.fn();
  const CloudResourceMock = Object.assign(
    function CloudResourceMock(this: any, data: any) {
      Object.assign(this, data);
      this.save = save;
    },
    {
      findOne: vi.fn(),
      countDocuments: vi.fn(),
      find: vi.fn(),
      findOneAndUpdate: vi.fn(),
      save,
    }
  );

  return { CloudResourceMock, save };
});

vi.mock('../../../models/CloudResource', () => ({
  CloudResource: mockCloudResourceCtor.CloudResourceMock,
}));

vi.mock('../../../models/CloudProvider', () => ({
  CloudProvider: {
    findOne: vi.fn(),
  },
}));

vi.mock('../../../models/AuditLog', () => ({
  AuditLog: {
    create: vi.fn(),
  },
}));

describe('CloudResourceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCloudResourceCtor.save.mockReset();
  });

  it('creates a resource when the provider exists and the resource is unique', async () => {
    const provider = { _id: 'prov-1', provider_name: 'AWS Main', provider_type: 'AWS' };
    const saved = { _id: 'resource-1', resource_name: 'web-01', provider_id: 'prov-1', provider_type: 'AWS' };

    (CloudProvider as any).findOne.mockResolvedValue(provider);
    (CloudResource as any).findOne.mockResolvedValue(null);
    mockCloudResourceCtor.save.mockResolvedValue(saved);

    const result = await CloudResourceService.createResource({
      provider_id: 'prov-1',
      resource_name: 'web-01',
      resource_type: 'EC2',
      service_name: 'EC2',
      region: 'us-east-1',
      status: 'running',
    }, 'user-1');

    expect(result).toMatchObject({
      provider_id: 'prov-1',
      provider_type: 'AWS',
      resource_name: 'web-01',
      service_name: 'EC2',
      status: 'running',
    });
    expect((CloudProvider as any).findOne).toHaveBeenCalledWith({ _id: 'prov-1', is_deleted: false });
    expect((CloudResource as any).findOne).toHaveBeenCalledWith({
      provider_id: provider._id,
      resource_name: 'web-01',
      is_deleted: false,
    });
    expect((AuditLog as any).create).toHaveBeenCalledWith({
      user_id: 'user-1',
      action: 'Resource Created',
      resource_type: 'Resources',
      description: 'Provisioned Cloud Resource: web-01 via AWS Main',
    });
  });

  it('throws when the provider does not exist', async () => {
    (CloudProvider as any).findOne.mockResolvedValue(null);

    await expect(CloudResourceService.createResource({
      provider_id: 'missing-provider',
      resource_name: 'web-01',
      resource_type: 'EC2',
      service_name: 'EC2',
      region: 'us-east-1',
    }, 'user-1')).rejects.toThrow('Invalid provider: Cloud Provider missing-provider not found or has been deleted.');
  });

  it('throws when the resource name already exists under the same provider', async () => {
    (CloudProvider as any).findOne.mockResolvedValue({ _id: 'prov-1', provider_name: 'AWS', provider_type: 'AWS' });
    (CloudResource as any).findOne.mockResolvedValue({ _id: 'duplicate' });

    await expect(CloudResourceService.createResource({
      provider_id: 'prov-1',
      resource_name: 'web-01',
      resource_type: 'EC2',
      service_name: 'EC2',
      region: 'us-east-1',
    }, 'user-1')).rejects.toThrow('Duplicate Resource: web-01 already exists under this provider.');
  });

  it('returns a list and total count for active resources', async () => {
    const data = [{ _id: 'resource-1', resource_name: 'web-01' }];
    const sortMock = vi.fn().mockReturnThis();
    const skipMock = vi.fn().mockReturnThis();
    const limitMock = vi.fn().mockReturnThis();
    const populateMock = vi.fn().mockReturnThis();

    (CloudResource as any).countDocuments.mockResolvedValue(1);
    (CloudResource as any).find.mockReturnValue({ sort: sortMock, skip: skipMock, limit: limitMock, populate: populateMock });
    sortMock.mockReturnValue({ skip: skipMock, limit: limitMock, populate: populateMock });
    skipMock.mockReturnValue({ limit: limitMock, populate: populateMock });
    limitMock.mockReturnValue({ populate: populateMock });
    populateMock.mockResolvedValue(data);

    const result = await CloudResourceService.getResources(0, 10, 'web', 'prov-1', 'running', 'monthly_cost');

    expect(result).toEqual({ data, total: 1, skip: 0, limit: 10 });
    expect((CloudResource as any).find).toHaveBeenCalledWith({
      is_deleted: false,
      $or: [
        { resource_name: { $regex: 'web', $options: 'i' } },
        { service_name: { $regex: 'web', $options: 'i' } },
        { owner: { $regex: 'web', $options: 'i' } },
        { project_name: { $regex: 'web', $options: 'i' } },
      ],
      provider_id: 'prov-1',
      status: 'running',
    });
  });

  it('returns null when the resource to update does not exist', async () => {
    (CloudResource as any).findOne.mockResolvedValue(null);

    const result = await CloudResourceService.updateResource('missing', { resource_name: 'new-name' }, 'user-1');

    expect(result).toBeNull();
  });

  it('soft deletes a resource and records an audit log', async () => {
    (CloudResource as any).findOneAndUpdate.mockResolvedValue({ _id: 'resource-1', resource_name: 'web-01' });

    const result = await CloudResourceService.deleteResource('resource-1', 'user-1');

    expect(result).toBe(true);
    expect((CloudResource as any).findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'resource-1', is_deleted: false },
      { is_deleted: true, status: 'terminated', updated_at: expect.any(Date) }
    );
    expect((AuditLog as any).create).toHaveBeenCalledWith({
      user_id: 'user-1',
      action: 'Resource Deleted',
      resource_type: 'Resources',
      description: 'Soft-Deleted Resource: web-01',
    });
  });

  it('returns the dashboard summary counts', async () => {
    (CloudResource as any).countDocuments
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(7)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1);

    const result = await CloudResourceService.getDashboardSummary();

    expect(result).toEqual({
      total_resources: 10,
      running_resources: 7,
      stopped_resources: 2,
      terminated_resources: 1,
      aws_resources: 6,
      azure_resources: 3,
      gcp_resources: 1,
    });
  });
});
