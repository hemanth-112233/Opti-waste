import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../app';
import { authHeader, clearDatabase, registerAndLogin } from './helpers';

describe('Provider and Resource API integration', () => {
  let adminToken: string;

  beforeEach(async () => {
    await clearDatabase();
    const admin = await registerAndLogin({
      name: 'Provider Admin',
      email: 'provider-admin@example.com',
      password: 'Password123!',
    });
    adminToken = admin.token;
  });

  it('lists providers and creates a provider with administrator permissions', async () => {
    const listBefore = await request(app)
      .get('/api/v1/providers')
      .set(authHeader(adminToken));

    expect(listBefore.status).toBe(200);
    expect(listBefore.body.data).toEqual(expect.any(Array));

    const providerPayload = {
      provider_name: 'AWS Core',
      provider_type: 'AWS',
      account_name: 'Ops Platform',
      account_id: 'aws-account-001',
      region: 'us-east-1',
      credentials: 'secret-key',
      status: 'active',
    };

    const created = await request(app)
      .post('/api/v1/providers')
      .set(authHeader(adminToken))
      .send(providerPayload);

    expect(created.status).toBe(201);
    expect(created.body.provider_name).toBe('AWS Core');
    expect(created.body.account_id).toBe('aws-account-001');
    expect(created.body.status).toBe('active');

    const listAfter = await request(app)
      .get('/api/v1/providers')
      .set(authHeader(adminToken));

    expect(listAfter.status).toBe(200);
    expect(listAfter.body.total).toBeGreaterThanOrEqual(1);
    expect(listAfter.body.data.some((p: any) => p.account_id === 'aws-account-001')).toBe(true);
  });

  it('gets, updates, activates, deactivates, and deletes a provider with the correct status flow', async () => {
    const provider = await request(app)
      .post('/api/v1/providers')
      .set(authHeader(adminToken))
      .send({
        provider_name: 'Azure Platform',
        provider_type: 'Azure',
        account_name: 'Ops Azure',
        account_id: 'azure-account-010',
        region: 'eastus',
      });

    expect(provider.status).toBe(201);
    const providerId = provider.body.id;

    const fetched = await request(app)
      .get(`/api/v1/providers/${providerId}`)
      .set(authHeader(adminToken));

    expect(fetched.status).toBe(200);
    expect(fetched.body.provider_name).toBe('Azure Platform');

    const updated = await request(app)
      .put(`/api/v1/providers/${providerId}`)
      .set(authHeader(adminToken))
      .send({ provider_name: 'Azure Platform Updated', region: 'westus2' });

    expect(updated.status).toBe(200);
    expect(updated.body.provider_name).toBe('Azure Platform Updated');
    expect(updated.body.region).toBe('westus2');

    const activated = await request(app)
      .put(`/api/v1/providers/${providerId}/activate`)
      .set(authHeader(adminToken));
    expect(activated.status).toBe(200);
    expect(activated.body.status).toBe('active');

    const deactivated = await request(app)
      .put(`/api/v1/providers/${providerId}/deactivate`)
      .set(authHeader(adminToken));
    expect(deactivated.status).toBe(200);
    expect(deactivated.body.status).toBe('inactive');

    const deleted = await request(app)
      .delete(`/api/v1/providers/${providerId}`)
      .set(authHeader(adminToken));
    expect(deleted.status).toBe(200);
    expect(deleted.body.success).toBe(true);

    const missing = await request(app)
      .get(`/api/v1/providers/${providerId}`)
      .set(authHeader(adminToken));
    expect(missing.status).toBe(404);
  });

  it('enforces authentication and RBAC for provider writes', async () => {
    const unauthenticated = await request(app)
      .post('/api/v1/providers')
      .send({
        provider_name: 'Unauthenticated',
        provider_type: 'AWS',
        account_name: 'Ops',
        account_id: 'aws-account-unauth',
        region: 'us-west-2',
      });
    expect(unauthenticated.status).toBe(401);

    const userAuth = await registerAndLogin({
      name: 'Regular User',
      email: 'regular-user@example.com',
      password: 'Password123!',
    });

    const forbidden = await request(app)
      .post('/api/v1/providers')
      .set(authHeader(userAuth.token))
      .send({
        provider_name: 'Not Allowed',
        provider_type: 'AWS',
        account_name: 'Ops',
        account_id: 'aws-account-forbidden',
        region: 'us-west-2',
      });

    expect(forbidden.status).toBe(403);
    expect(forbidden.body.code).toBe('FORBIDDEN');
  });

  it('rejects invalid provider payloads and missing providers', async () => {
    const invalid = await request(app)
      .post('/api/v1/providers')
      .set(authHeader(adminToken))
      .send({ provider_name: '', provider_type: '', account_name: '', account_id: '', region: '' });

    expect(invalid.status).toBe(422);
    expect(invalid.body.success).toBe(false);

    const missing = await request(app)
      .get('/api/v1/providers/00000000-0000-4000-8000-000000000000')
      .set(authHeader(adminToken));

    expect(missing.status).toBe(404);
    expect(missing.body.detail).toBe('Provider not found');
  });

  it('creates, lists, updates, and deletes resources behind the correct access rules', async () => {
    const providerResponse = await request(app)
      .post('/api/v1/providers')
      .set(authHeader(adminToken))
      .send({
        provider_name: 'AWS Compute',
        provider_type: 'AWS',
        account_name: 'Compute Account',
        account_id: 'aws-resource-account',
        region: 'us-east-1',
      });

    const providerId = providerResponse.body.id;

    const create = await request(app)
      .post('/api/v1/resources')
      .set(authHeader(adminToken))
      .send({
        provider_id: providerId,
        provider_type: 'AWS',
        resource_name: 'prod-api',
        resource_type: 'EC2',
        instance_type: 'm5.large',
        service_name: 'Compute',
        region: 'us-east-1',
        status: 'running',
        cpu: 20,
        memory: 8,
        storage: 100,
        monthly_cost: 120,
      });

    expect(create.status).toBe(201);
    expect(create.body.resource_name).toBe('prod-api');
    const resourceId = create.body.id;

    const list = await request(app)
      .get('/api/v1/resources')
      .set(authHeader(adminToken));
    expect(list.status).toBe(200);
    expect(list.body.total).toBeGreaterThanOrEqual(1);

    const detail = await request(app)
      .get(`/api/v1/resources/${resourceId}`)
      .set(authHeader(adminToken));
    expect(detail.status).toBe(200);
    expect(detail.body.resource_name).toBe('prod-api');

    const update = await request(app)
      .put(`/api/v1/resources/${resourceId}`)
      .set(authHeader(adminToken))
      .send({ status: 'stopped', monthly_cost: 90 });
    expect(update.status).toBe(200);
    expect(update.body.status).toBe('stopped');
    expect(update.body.monthly_cost).toBe(90);

    const deleted = await request(app)
      .delete(`/api/v1/resources/${resourceId}`)
      .set(authHeader(adminToken));
    expect(deleted.status).toBe(200);
    expect(deleted.body.success).toBe(true);

    const missing = await request(app)
      .get(`/api/v1/resources/${resourceId}`)
      .set(authHeader(adminToken));
    expect(missing.status).toBe(404);
  });

  it('blocks resource writes for non-admin roles and rejects invalid resource payloads', async () => {
    const providerResponse = await request(app)
      .post('/api/v1/providers')
      .set(authHeader(adminToken))
      .send({
        provider_name: 'AWS Compute 2',
        provider_type: 'AWS',
        account_name: 'Compute Account 2',
        account_id: 'aws-resource-account-2',
        region: 'us-east-2',
      });

    const userAuth = await registerAndLogin({
      name: 'Resource User',
      email: 'resource-user@example.com',
      password: 'Password123!',
    });

    const forbidden = await request(app)
      .post('/api/v1/resources')
      .set(authHeader(userAuth.token))
      .send({
        provider_id: providerResponse.body.id,
        provider_type: 'AWS',
        resource_name: 'not-allowed-resource',
        resource_type: 'EC2',
        service_name: 'Compute',
        region: 'us-east-2',
        status: 'running',
      });
    expect(forbidden.status).toBe(403);

    const invalid = await request(app)
      .post('/api/v1/resources')
      .set(authHeader(adminToken))
      .send({
        provider_id: providerResponse.body.id,
        provider_type: 'AWS',
        resource_name: '',
        resource_type: '',
        service_name: '',
        region: '',
        status: '',
      });
    expect(invalid.status).toBe(422);
  });
});
