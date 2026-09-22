import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CloudProviderService } from '../../../services/CloudProviderService';
import { CloudProvider } from '../../../models/CloudProvider';
import { AuditLog } from '../../../models/AuditLog';
import { encryptCredentials } from '../../../utils/encryption';

vi.mock('../../../utils/encryption', () => ({
  encryptCredentials: vi.fn(),
}));

vi.mock('../../../models/CloudProvider', () => ({
  CloudProvider: Object.assign(
    function CloudProviderMock(this: any, data: any) {
      Object.assign(this, data);
      this.save = vi.fn().mockResolvedValue(this);
    },
    {
      findOne: vi.fn(),
      countDocuments: vi.fn(),
      find: vi.fn(),
      findOneAndUpdate: vi.fn(),
    }
  ),
}));

vi.mock('../../../models/AuditLog', () => ({
  AuditLog: { create: vi.fn() },
}));

describe('CloudProviderService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates a provider, encrypts credentials, and logs the action', async () => {
    const providerData = {
      provider_name: 'AWS Main',
      provider_type: 'AWS',
      account_name: 'Ops Team',
      account_id: 'acct-123',
      region: 'us-east-1',
      credentials: { key: 'secret' },
    };
    const encrypted = { credentials: 'enc', credentials_iv: 'iv', auth_tag: 'tag' };

    (encryptCredentials as any).mockReturnValue(encrypted);
    (CloudProvider as any).findOne.mockResolvedValue(null);
    const saved = { ...providerData, ...encrypted, _id: 'provider-1', status: 'active' };
    const saveMock = vi.fn().mockResolvedValue(saved);
    (CloudProvider as any).mockImplementation = function (this: any, data: any) {
      Object.assign(this, data);
      this.save = saveMock;
    };

    const result = await CloudProviderService.createProvider(providerData as any, 'user-1');

    expect((encryptCredentials as any)).toHaveBeenCalledWith({ key: 'secret' });
    expect(result).toMatchObject({
      provider_name: 'AWS Main',
      provider_type: 'AWS',
      account_id: 'acct-123',
    });
    expect((AuditLog as any).create).toHaveBeenCalledWith({
      user_id: 'user-1',
      action: 'Provider Created',
      resource_type: 'Providers',
      description: 'Created Cloud Provider: AWS Main (AWS)',
    });
  });

  it('throws when the account ID is duplicated', async () => {
    (CloudProvider as any).findOne.mockResolvedValue({ _id: 'existing-provider' });

    await expect(CloudProviderService.createProvider({
      provider_name: 'AWS Main',
      provider_type: 'AWS',
      account_name: 'Ops Team',
      account_id: 'acct-123',
      region: 'us-east-1',
    }, 'user-1')).rejects.toThrow('Duplicate account ID');
  });

  it('lists providers with the requested search, filter, and sort', async () => {
    const query = {
      is_deleted: false,
      $or: [
        { provider_name: { $regex: 'aws', $options: 'i' } },
        { account_name: { $regex: 'aws', $options: 'i' } },
        { account_id: { $regex: 'aws', $options: 'i' } },
      ],
      status: 'active',
    };
    const data = [{ _id: 'provider-1', provider_name: 'AWS Main' }];
    const sortMock = vi.fn().mockReturnThis();
    const skipMock = vi.fn().mockReturnThis();
    const limitMock = vi.fn().mockReturnThis();

    (CloudProvider as any).countDocuments.mockResolvedValue(1);
    (CloudProvider as any).find.mockReturnValue({ sort: sortMock, skip: skipMock, limit: limitMock });
    sortMock.mockReturnValue({ skip: skipMock, limit: limitMock });
    skipMock.mockReturnValue({ limit: limitMock });
    limitMock.mockResolvedValue(data);

    const result = await CloudProviderService.getProviders(0, 25, 'aws', 'active', 'provider_name');

    expect(result).toEqual({ data, total: 1, skip: 0, limit: 25 });
    expect((CloudProvider as any).find).toHaveBeenCalledWith(query);
  });

  it('returns null for a missing provider update', async () => {
    (CloudProvider as any).findOne.mockResolvedValue(null);

    const result = await CloudProviderService.updateProvider('missing', { provider_name: 'Updated' }, 'user-1');

    expect(result).toBeNull();
  });

  it('throws when the updated account ID would duplicate another provider', async () => {
    const existing = { _id: 'provider-1', account_id: 'old-id' };
    (CloudProvider as any).findOne.mockResolvedValue(existing);
    (CloudProvider as any).findOne.mockResolvedValueOnce(existing).mockResolvedValueOnce({ _id: 'provider-2', account_id: 'new-id' });

    await expect(CloudProviderService.updateProvider('provider-1', { account_id: 'new-id' }, 'user-1')).rejects.toThrow('Duplicate account ID');
  });

  it('sets status and logs activation/deactivation', async () => {
    const provider = { _id: 'provider-1', provider_name: 'AWS Main' };
    (CloudProvider as any).findOneAndUpdate.mockResolvedValue(provider);

    const result = await CloudProviderService.setProviderStatus('provider-1', 'active', 'user-1');

    expect(result).toEqual(provider);
    expect((CloudProvider as any).findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'provider-1', is_deleted: false },
      { status: 'active', updated_at: expect.any(Date) },
      { new: true }
    );
    expect((AuditLog as any).create).toHaveBeenCalledWith({
      user_id: 'user-1',
      action: 'Provider Activated',
      resource_type: 'Providers',
      description: 'Activated Provider: AWS Main',
    });
  });

  it('soft deletes a provider and logs the audit entry', async () => {
    (CloudProvider as any).findOneAndUpdate.mockResolvedValue({ _id: 'provider-1', provider_name: 'AWS Main' });

    const result = await CloudProviderService.deleteProvider('provider-1', 'user-1');

    expect(result).toBe(true);
    expect((CloudProvider as any).findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'provider-1', is_deleted: false },
      { is_deleted: true, status: 'deleted', updated_at: expect.any(Date) }
    );
  });
});
