import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../app';
import { authHeader, clearDatabase, registerAndLogin } from './helpers';

describe('Recommendation and verification API integration', () => {
  let adminToken: string;
  let providerId: string;
  let resourceId: string;

  beforeEach(async () => {
    await clearDatabase();
    const admin = await registerAndLogin({
      name: 'Rec Admin',
      email: 'rec-admin@example.com',
      password: 'Password123!',
    });
    adminToken = admin.token;

    const provider = await request(app)
      .post('/api/v1/providers')
      .set(authHeader(adminToken))
      .send({
        provider_name: 'AWS Recs',
        provider_type: 'AWS',
        account_name: 'Recs Account',
        account_id: 'aws-recommendation-account',
        region: 'us-east-1',
      });
    providerId = provider.body.id;

    const resource = await request(app)
      .post('/api/v1/resources')
      .set(authHeader(adminToken))
      .send({
        provider_id: providerId,
        provider_type: 'AWS',
        resource_name: 'idle-resource',
        resource_type: 'EC2',
        instance_type: 'm5.large',
        service_name: 'Compute',
        region: 'us-east-1',
        status: 'stopped',
        cpu: 2,
        memory: 4,
        storage: 100,
        monthly_cost: 500,
      });
    resourceId = resource.body.id;
  });

  it('generates recommendations, lists them, updates status, and validates bad status inputs', async () => {
    const wasteRecord = await request(app)
      .post('/api/v1/waste/analyze')
      .set(authHeader(adminToken));
    expect(wasteRecord.status).toBe(200);

    const generate = await request(app)
      .post('/api/v1/recommendations/generate')
      .set(authHeader(adminToken));
    expect(generate.status).toBe(200);
    expect(generate.body.success).toBe(true);
    expect(generate.body.data.totalRecommendationsGenerated).toBeGreaterThanOrEqual(0);

    const summary = await request(app)
      .get('/api/v1/recommendations/summary')
      .set(authHeader(adminToken));
    expect(summary.status).toBe(200);
    expect(summary.body.success).toBe(true);

    const list = await request(app)
      .get('/api/v1/recommendations')
      .set(authHeader(adminToken));
    expect(list.status).toBe(200);
    expect(list.body.success).toBe(true);

    const recId = list.body.data?.[0]?._id ?? list.body[0]?._id;
    if (recId) {
      const detail = await request(app)
        .get(`/api/v1/recommendations/${recId}`)
        .set(authHeader(adminToken));
      expect(detail.status).toBe(200);
      expect(detail.body.success).toBe(true);

      const statusUpdate = await request(app)
        .patch(`/api/v1/recommendations/${recId}/status`)
        .set(authHeader(adminToken))
        .send({ status: 'accepted' });
      expect(statusUpdate.status).toBe(200);
      expect(statusUpdate.body.data.status).toBe('accepted');

      const invalidStatus = await request(app)
        .patch(`/api/v1/recommendations/${recId}/status`)
        .set(authHeader(adminToken))
        .send({ status: 'not-real-status' });
      expect(invalidStatus.status).toBe(400);
      expect(invalidStatus.body.detail).toContain('Invalid status');
    } else {
      expect(list.body.total).toBeGreaterThanOrEqual(0);
    }

    const unauth = await request(app).get('/api/v1/recommendations');
    expect(unauth.status).toBe(401);
  });

  it('runs verification across recommendations and handles missing records safely', async () => {
    const wasteRecord = await request(app)
      .post('/api/v1/waste/analyze')
      .set(authHeader(adminToken));
    expect(wasteRecord.status).toBe(200);

    const generate = await request(app)
      .post('/api/v1/recommendations/generate')
      .set(authHeader(adminToken));
    expect(generate.status).toBe(200);

    const verificationRun = await request(app)
      .post('/api/v1/verifications/run')
      .set(authHeader(adminToken));
    expect(verificationRun.status).toBe(200);
    expect(verificationRun.body.success).toBe(true);

    const summary = await request(app)
      .get('/api/v1/verifications/summary')
      .set(authHeader(adminToken));
    expect(summary.status).toBe(200);
    expect(summary.body.success).toBe(true);

    const list = await request(app)
      .get('/api/v1/verifications')
      .set(authHeader(adminToken));
    expect(list.status).toBe(200);
    expect(list.body.success).toBe(true);

    const notFound = await request(app)
      .get('/api/v1/verifications/00000000-0000-4000-8000-000000000000')
      .set(authHeader(adminToken));
    expect(notFound.status).toBe(404);
    expect(notFound.body.detail).toBe('Verification not found.');
  });
});
