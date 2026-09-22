import request from 'supertest';
import { describe, expect, it, beforeEach } from 'vitest';
import { app } from '../../app';
import { clearDatabase, registerAndLogin, authHeader } from './helpers';

describe('Auth API integration', () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  it('registers, logs in, fetches the current user, refreshes the token, and logs out', async () => {
    const email = 'admin@example.com';
    const password = 'Password123!';

    const signup = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Admin User', email, password });

    expect(signup.status).toBe(201);
    expect(signup.body.success).toBe(true);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password });

    expect(login.status).toBe(200);
    expect(login.body.success).toBe(true);
    expect(login.body.access_token).toBeTruthy();
    expect(login.body.refresh_token).toBeTruthy();

    const me = await request(app)
      .get('/api/v1/auth/me')
      .set(authHeader(login.body.access_token));

    expect(me.status).toBe(200);
    expect(me.body.success).toBe(true);
    expect(me.body.user.email).toBe(email);
    expect(me.body.user.role).toBe('Administrator');

    const refreshed = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: login.body.refresh_token });

    expect(refreshed.status).toBe(200);
    expect(refreshed.body.success).toBe(true);
    expect(refreshed.body.access_token).toBeTruthy();
    expect(refreshed.body.user.email).toBe(email);

    const logout = await request(app)
      .post('/api/v1/auth/logout');

    expect(logout.status).toBe(200);
    expect(logout.body.success).toBe(true);
    expect(logout.body.message).toContain('Logged out');
  });

  it('rejects invalid credentials and invalid refresh tokens', async () => {
    const email = 'user@example.com';
    const password = 'Password123!';

    await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'User One', email, password });

    const badLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'WrongPassword' });

    expect(badLogin.status).toBe(401);
    expect(badLogin.body.success).toBe(false);
    expect(badLogin.body.code).toBe('UNAUTHORIZED');

    const invalidRefresh = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: 'bad-token' });

    expect(invalidRefresh.status).toBe(401);
    expect(invalidRefresh.body.success).toBe(false);
    expect(invalidRefresh.body.code).toBe('UNAUTHORIZED');
  });

  it('requires a valid bearer token for protected endpoints and validates request bodies', async () => {
    const missingToken = await request(app).get('/api/v1/auth/me');
    expect(missingToken.status).toBe(401);
    expect(missingToken.body.message).toBe('Authentication required');

    const invalidPayload = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Bad User', email: 'bad-email', password: '123' });

    expect(invalidPayload.status).toBe(422);
    expect(invalidPayload.body.success).toBe(false);
    expect(invalidPayload.body.code).toBe('VALIDATION_ERROR');

    const invalidLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ password: 'x' });

    expect(invalidLogin.status).toBe(422);
    expect(invalidLogin.body.success).toBe(false);
  });

  it('returns a duplicate-email error for an already registered account', async () => {
    const payload = { name: 'Jane Doe', email: 'jane@example.com', password: 'Password123!' };

    const first = await request(app)
      .post('/api/v1/auth/register')
      .send(payload);
    expect(first.status).toBe(201);

    const duplicate = await request(app)
      .post('/api/v1/auth/register')
      .send(payload);

    expect(duplicate.status).toBe(400);
    expect(duplicate.body.success).toBe(false);
    expect(duplicate.body.message).toContain('already exists');
  });

  it('supports signup alias and login with username compatibility', async () => {
    const loginWithUsername = await request(app)
      .post('/api/v1/auth/signup')
      .send({ name: 'Alias User', email: 'alias@example.com', password: 'Password123!' });

    expect(loginWithUsername.status).toBe(201);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'alias@example.com', password: 'Password123!' });

    expect(login.status).toBe(200);
    expect(login.body.user.email).toBe('alias@example.com');
  });

  it('accepts the helper-based admin login flow', async () => {
    const admin = await registerAndLogin({
      name: 'Helper Admin',
      email: 'helper-admin@example.com',
      password: 'Password123!',
    });

    expect(admin.token).toBeTruthy();
    expect(admin.user.email).toBe('helper-admin@example.com');
  });
});
