import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import authRoutes from '../../../routes/authRoutes';
import { AuthService } from '../../../services/AuthService';
import { User } from '../../../models/User';

const { userSave, UserMock } = vi.hoisted(() => {
  const userSave = vi.fn();
  const UserMock = Object.assign(
    vi.fn(function UserMock(this: any, data: any) {
      Object.assign(this, data);
      this.save = userSave;
    }),
    {
      findOne: vi.fn(),
      countDocuments: vi.fn(),
      findById: vi.fn(),
      findOneAndUpdate: vi.fn(),
    }
  );

  return { userSave, UserMock };
});

vi.mock('../../../middleware/authMiddleware', () => ({
  authenticateToken: async (req: any, _res: any, next: () => void) => {
    req.user = { id: 'user-123', sub: 'user-123', email: 'alice@example.com', name: 'Alice', role: 'Administrator' };
    next();
  },
}));

vi.mock('../../../middleware/validationMiddleware', () => ({
  validate: () => (_req: any, _res: any, next: () => void) => next(),
}));

vi.mock('../../../services/AuthService', () => ({
  AuthService: {
    authenticateUser: vi.fn(),
    hashPassword: vi.fn(),
    seedDefaultRoles: vi.fn(),
    getUserRole: vi.fn(),
    verifyRefreshToken: vi.fn(),
    generateTokens: vi.fn(),
  },
  ROLES: {
    ADMINISTRATOR: 'Administrator',
    CLOUD_ENGINEER: 'Cloud Engineer',
    ANALYST: 'Analyst',
    USER: 'User',
  },
}));

vi.mock('../../../models/User', () => ({
  User: UserMock,
}));

vi.mock('../../../models/Role', () => ({
  Role: {
    findOne: vi.fn(),
  },
}));

const app = express();
app.use(express.json());
app.use('/api/v1/auth', authRoutes);

describe('authRoutes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userSave.mockReset();
    delete process.env.ADMIN_SETUP_SECRET;
  });

  it('logs in a valid user and returns auth payload', async () => {
    (AuthService.authenticateUser as any).mockResolvedValue({
      user: { id: 'user-123', name: 'Alice', email: 'alice@example.com', role: 'Administrator', avatar: null },
      tokens: { access_token: 'access-token', refresh_token: 'refresh-token', token_type: 'Bearer' },
    });

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'alice@example.com', password: 'Password123!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.access_token).toBe('access-token');
    expect(AuthService.authenticateUser).toHaveBeenCalledWith('alice@example.com', 'Password123!');
  });

  it('returns 401 when login credentials are invalid', async () => {
    (AuthService.authenticateUser as any).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'alice@example.com', password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({
      success: false,
      message: 'Invalid email or password',
      code: 'UNAUTHORIZED',
    });
  });

  it('creates the first administrator account on signup', async () => {
    (User as any).findOne.mockResolvedValue(null);
    (User as any).countDocuments.mockResolvedValue(0);
    (AuthService.hashPassword as any).mockResolvedValue('hashed-password');
    (AuthService.seedDefaultRoles as any).mockResolvedValue({});
    (AuthService.getUserRole as any).mockResolvedValue(null);
    const { Role } = await import('../../../models/Role');
    (Role.findOne as any).mockResolvedValue({ _id: 'admin-role' });
    userSave.mockResolvedValue(true);

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Alice User', email: 'alice@example.com', password: 'Password123!' });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe('Administrator account created successfully');
    expect(userSave).toHaveBeenCalledTimes(1);
  });

  it('rejects duplicate email registrations', async () => {
    (User as any).findOne.mockResolvedValue({ _id: 'existing-user' });

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Alice User', email: 'alice@example.com', password: 'Password123!' });

    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      message: 'An account with this email already exists',
      code: 'CONFLICT',
    });
  });

  it('returns the authenticated user from /me', async () => {
    (User as any).findById.mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({
        _id: 'user-123',
        name: 'Alice',
        email: 'alice@example.com',
        role: { name: 'Administrator' },
      }),
    });

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer valid-token');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      user: {
        id: 'user-123',
        name: 'Alice',
        email: 'alice@example.com',
        role: 'Administrator',
        avatar: null,
      },
    });
  });

  it('refreshes a valid token and returns a new pair', async () => {
    (AuthService.verifyRefreshToken as any).mockResolvedValue({
      _id: 'user-123',
      email: 'alice@example.com',
      name: 'Alice',
      role: { name: 'Administrator' },
    });
    (AuthService.generateTokens as any).mockReturnValue({
      access_token: 'new-access',
      refresh_token: 'new-refresh',
      token_type: 'Bearer',
    });

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: 'valid-refresh-token' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.access_token).toBe('new-access');
    expect(AuthService.generateTokens).toHaveBeenCalledWith(
      'user-123',
      'Administrator',
      'alice@example.com',
      'Alice'
    );
  });

  it('rejects invalid refresh tokens', async () => {
    (AuthService.verifyRefreshToken as any).mockResolvedValue(null);

    const res = await request(app)
      .post('/api/v1/auth/refresh')
      .send({ refresh_token: 'bad-token' });

    expect(res.status).toBe(401);
    expect(res.body).toMatchObject({
      success: false,
      message: 'Invalid or expired refresh token',
      code: 'UNAUTHORIZED',
    });
  });

  it('promotes a user to admin when the setup secret matches', async () => {
    process.env.ADMIN_SETUP_SECRET = 'top-secret';
    (AuthService.seedDefaultRoles as any).mockResolvedValue({});
    const { Role } = await import('../../../models/Role');
    (Role.findOne as any).mockResolvedValue({ _id: 'admin-role', name: 'Administrator' });
    (User as any).findOneAndUpdate.mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({
        email: 'alice@example.com',
        role: { name: 'Administrator' },
      }),
    });

    const res = await request(app)
      .post('/api/v1/auth/setup-admin')
      .send({ email: 'alice@example.com', secret: 'top-secret' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.role).toBe('Administrator');
  });

  it('returns 404 when the admin setup endpoint is disabled', async () => {
    const res = await request(app)
      .post('/api/v1/auth/setup-admin')
      .send({ email: 'alice@example.com', secret: 'missing' });

    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({
      success: false,
      message: 'Not found',
    });
  });

  it('returns a logout success message', async () => {
    const res = await request(app)
      .post('/api/v1/auth/logout');

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      message: 'Logged out successfully',
    });
  });
});
