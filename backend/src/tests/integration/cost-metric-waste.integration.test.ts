import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../app';
import { authHeader, clearDatabase, registerAndLogin } from './helpers';

describe('Cost, metric, and waste integration', () => {
  let adminToken: string;
  let providerId: string;
  let resourceId: string;

  beforeEach(async () => {
    await clearDatabase();
    const admin = await registerAndLogin({
      name: 'Ops Admin',
      email: 'ops-admin@example.com',
      password: 'Password123!',
    });
    adminToken = admin.token;

    const provider = await request(app)
      .post('/api/v1/providers')
      .set(authHeader(adminToken))
      .send({
        provider_name: 'AWS Ops',
        provider_type: 'AWS',
        account_name: 'Ops Account',
        account_id: 'aws-cost-account',
        region: 'us-east-1',
      });

    providerId = provider.body.id;

    const resource = await request(app)
      .post('/api/v1/resources')
      .set(authHeader(adminToken))
      .send({
        provider_id: providerId,
        provider_type: 'AWS',
        resource_name: 'cost-resource',
        resource_type: 'EC2',
        instance_type: 'm5.large',
        service_name: 'Compute',
        region: 'us-east-1',
        status: 'running',
        cpu: 20,
        memory: 8,
        storage: 200,
        monthly_cost: 120,
      });

    resourceId = resource.body.id;
  });

  it('lists dashboard data, creates cost records, filters them, and validates invalid payloads', async () => {
    const dashboard = await request(app)
      .get('/api/v1/costs/dashboard')
      .set(authHeader(adminToken));
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.summary).toBeTruthy();

    const createCost = await request(app)
      .post('/api/v1/costs')
      .set(authHeader(adminToken))
      .send({
        resource_id: resourceId,
        provider_id: providerId,
        billing_period: '2026-09',
        daily_cost: 4,
        weekly_cost: 28,
        monthly_cost: 120,
        projected_monthly_cost: 145,
        billing_status: 'finalized',
        cost_timestamp: new Date().toISOString(),
      });

    expect(createCost.status).toBe(201);
    expect(createCost.body.resource_id).toBe(resourceId); 

    const listWithFilter = await request(app)
      .get(`/api/v1/costs?resource_id=${resourceId}&provider_id=${providerId}&limit=10`)
      .set(authHeader(adminToken));
    expect(listWithFilter.status).toBe(200);
    expect(listWithFilter.body.total).toBeGreaterThanOrEqual(1);

    const invalid = await request(app)
      .post('/api/v1/costs')
      .set(authHeader(adminToken))
      .send({
        resource_id: 'invalid-id',
        provider_id: providerId,
        billing_period: '',
        daily_cost: -1,
      });
    expect(invalid.status).toBe(422);

    const unauthenticated = await request(app).get('/api/v1/costs');
    expect(unauthenticated.status).toBe(401);
  });

  it('creates metrics, reads latest/history endpoints, and rejects invalid utilization values', async () => {
    const metricCreate = await request(app)
      .post('/api/v1/metrics')
      .set(authHeader(adminToken))
      .send({
        resource_id: resourceId,
        cpu_utilization: 12,
        memory_utilization: 8,
        storage_utilization: 40,
        network_in: 20,
        network_out: 30,
        disk_read: 10,
        disk_write: 5,
        uptime_hours: 200,
        instance_state: 'running',
        metric_timestamp: new Date().toISOString(),
      });

    expect(metricCreate.status).toBe(201);
    expect(metricCreate.body.resource_id).toBe(resourceId);

    const latest = await request(app)
      .get(`/api/v1/metrics/latest/${resourceId}`)
      .set(authHeader(adminToken));
    expect(latest.status).toBe(200);
    expect(latest.body.resource_id).toEqual(expect.objectContaining({ id: resourceId }));

    const history = await request(app)
      .get(`/api/v1/metrics/history/${resourceId}?skip=0&limit=10`)
      .set(authHeader(adminToken));
    expect(history.status).toBe(200);
    expect(history.body.total).toBeGreaterThanOrEqual(1);

    const invalid = await request(app)
      .post('/api/v1/metrics')
      .set(authHeader(adminToken))
      .send({
        resource_id: resourceId,
        cpu_utilization: 101,
        memory_utilization: 5,
        storage_utilization: 10,
      });
    expect(invalid.status).toBe(422);

    const missing = await request(app)
      .get('/api/v1/metrics/00000000-0000-4000-8000-000000000000')
      .set(authHeader(adminToken));
    expect(missing.status).toBe(404);
  });

  it('supports waste analysis summary and finding retrieval with auth', async () => {
    const summaryBefore = await request(app)
      .get('/api/v1/waste/summary')
      .set(authHeader(adminToken));
    expect(summaryBefore.status).toBe(200);
    expect(summaryBefore.body.success).toBe(true);

    const find = await request(app)
      .get('/api/v1/waste/findings')
      .set(authHeader(adminToken));
    expect(find.status).toBe(200);
    expect(find.body.success).toBe(true);

    const analysis = await request(app)
      .post('/api/v1/waste/analyze')
      .set(authHeader(adminToken));
    expect(analysis.status).toBe(200);
    expect(analysis.body.success).toBe(true);
    expect(analysis.body.message).toContain('Waste analysis completed');

    const findings = await request(app)
      .get('/api/v1/waste/findings')
      .set(authHeader(adminToken));
    expect(findings.status).toBe(200);
    expect(findings.body.success).toBe(true);

    const noAuth = await request(app).post('/api/v1/waste/analyze');
    expect(noAuth.status).toBe(401);
  });
});
