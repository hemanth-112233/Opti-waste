import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';
import jwt from 'jsonwebtoken';
import { authenticateToken } from '../../../middleware/authMiddleware';
import { User } from '../../../models/User';

vi.mock('jsonwebtoken', () => ({
  default: {
    verify: vi.fn(),
  },
}));

vi.mock('../../../config/env', () => ({
  env: {
    JWT_SECRET: 'test-secret',
  },
}));

vi.mock('../../../models/User', () => ({
  User: {
    findById: vi.fn(),
  },
}));

const makeResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe('authMiddleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when the Authorization header is missing', async () => {
    const req: any = { headers: {} };
    const res = makeResponse() as unknown as Response;
    const next = vi.fn();

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Authentication required',
      code: 'UNAUTHORIZED',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when the Authorization header is malformed', async () => {
    const req: any = { headers: { authorization: 'Bearer' } };
    const res = makeResponse() as unknown as Response;
    const next = vi.fn();

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Authentication required',
      code: 'UNAUTHORIZED',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when the JWT is invalid or expired', async () => {
    const req: any = { headers: { authorization: 'Bearer invalid-token' } };
    const res = makeResponse() as unknown as Response;
    const next = vi.fn();

    (jwt as any).verify.mockImplementation(() => {
      throw new Error('expired');
    });

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Invalid or expired token',
      code: 'UNAUTHORIZED',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 for a token payload without a user id', async () => {
    const req: any = { headers: { authorization: 'Bearer missing-sub' } };
    const res = makeResponse() as unknown as Response;
    const next = vi.fn();

    (jwt as any).verify.mockReturnValue({});

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Invalid token payload',
      code: 'UNAUTHORIZED',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('attaches enriched JWT user data and calls next()', async () => {
    const req: any = { headers: { authorization: 'Bearer valid-token' } };
    const res = makeResponse() as unknown as Response;
    const next = vi.fn();

    (jwt as any).verify.mockReturnValue({
      sub: 'user-123',
      email: 'alice@example.com',
      name: 'Alice',
      role: 'Administrator',
    });

    await authenticateToken(req, res, next);

    expect(req.user).toEqual({
      id: 'user-123',
      sub: 'user-123',
      email: 'alice@example.com',
      name: 'Alice',
      role: 'Administrator',
    });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('loads legacy tokens from MongoDB when the JWT is missing user details', async () => {
    const req: any = { headers: { authorization: 'Bearer legacy-token' } };
    const res = makeResponse() as unknown as Response;
    const next = vi.fn();

    (jwt as any).verify.mockReturnValue({ sub: 'user-456', role: 'Cloud Engineer' });
    (User as any).findById.mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({
        _id: 'user-456',
        email: 'legacy@example.com',
        name: 'Legacy User',
        is_active: true,
        role: { name: 'Cloud Engineer' },
      }),
    });

    await authenticateToken(req, res, next);

    expect(req.user).toEqual({
      id: 'user-456',
      sub: 'user-456',
      email: 'legacy@example.com',
      name: 'Legacy User',
      role: 'Cloud Engineer',
    });
    expect((User as any).findById).toHaveBeenCalledWith('user-456');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('returns 401 when the legacy user is missing or inactive', async () => {
    const req: any = { headers: { authorization: 'Bearer legacy-token' } };
    const res = makeResponse() as unknown as Response;
    const next = vi.fn();

    (jwt as any).verify.mockReturnValue({ sub: 'missing-user', role: 'User' });
    (User as any).findById.mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({
        _id: 'missing-user',
        is_active: false,
      }),
    });

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'User not found or inactive',
      code: 'UNAUTHORIZED',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when User.findById throws during legacy-token fallback', async () => {
    const req: any = { headers: { authorization: 'Bearer legacy-token' } };
    const res = makeResponse() as unknown as Response;
    const next = vi.fn();

    (jwt as any).verify.mockReturnValue({ sub: 'user-throw', role: 'User' });
    (User as any).findById.mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      lean: vi.fn().mockRejectedValue(new Error('db failed')),
    });

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Could not authenticate user',
      code: 'UNAUTHORIZED',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when the legacy DB user is inactive', async () => {
    const req: any = { headers: { authorization: 'Bearer legacy-token' } };
    const res = makeResponse() as unknown as Response;
    const next = vi.fn();

    (jwt as any).verify.mockReturnValue({ sub: 'user-inactive', role: 'User' });
    (User as any).findById.mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({
        _id: 'user-inactive',
        email: 'inactive@example.com',
        name: 'Inactive User',
        is_active: false,
        role: { name: 'User' },
      }),
    });

    await authenticateToken(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'User not found or inactive',
      code: 'UNAUTHORIZED',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('defaults req.user.role to "User" when DB user has no role and decoded.role is missing', async () => {
    const req: any = { headers: { authorization: 'Bearer legacy-token' } };
    const res = makeResponse() as unknown as Response;
    const next = vi.fn();

    (jwt as any).verify.mockReturnValue({ sub: 'user-default-role' });
    (User as any).findById.mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({
        _id: 'user-default-role',
        email: 'default@example.com',
        name: 'Default User',
        is_active: true,
        role: null,
      }),
    });

    await authenticateToken(req, res, next);

    expect(req.user).toEqual({
      id: 'user-default-role',
      sub: 'user-default-role',
      email: 'default@example.com',
      name: 'Default User',
      role: 'User',
    });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('uses JWT data directly and does not require a DB lookup for enriched tokens', async () => {
    const req: any = { headers: { authorization: 'Bearer jwt-token' } };
    const res = makeResponse() as unknown as Response;
    const next = vi.fn();

    (jwt as any).verify.mockReturnValue({
      sub: 'user-123',
      email: 'alice@example.com',
      name: 'Alice',
      role: 'Administrator',
    });

    await authenticateToken(req, res, next);

    expect(req.user).toEqual({
      id: 'user-123',
      sub: 'user-123',
      email: 'alice@example.com',
      name: 'Alice',
      role: 'Administrator',
    });
    expect((User as any).findById).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('uses decoded.role when the DB user has no role on a legacy token', async () => {
    const req: any = { headers: { authorization: 'Bearer legacy-token' } };
    const res = makeResponse() as unknown as Response;
    const next = vi.fn();

    (jwt as any).verify.mockReturnValue({ sub: 'user-legacy-role', role: 'Cloud Engineer' });
    (User as any).findById.mockReturnValue({
      populate: vi.fn().mockReturnThis(),
      lean: vi.fn().mockResolvedValue({
        _id: 'user-legacy-role',
        email: 'legacy-role@example.com',
        name: 'Legacy Role User',
        is_active: true,
        role: null,
      }),
    });

    await authenticateToken(req, res, next);

    expect(req.user).toEqual({
      id: 'user-legacy-role',
      sub: 'user-legacy-role',
      email: 'legacy-role@example.com',
      name: 'Legacy Role User',
      role: 'Cloud Engineer',
    });
    expect(next).toHaveBeenCalledTimes(1);
  });
});
