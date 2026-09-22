import { describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';
import { requireRoles } from '../../../middleware/rbacMiddleware';

const makeResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe('rbacMiddleware', () => {
  it('allows a user whose role is in the allowed list', () => {
    const req: any = { user: { role: 'Administrator' } };
    const res = makeResponse() as unknown as Response;
    const next = vi.fn();

    requireRoles(['Administrator', 'Cloud Engineer'])(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it('allows the admin alias for administrator', () => {
    const req: any = { user: { role: 'admin' } };
    const res = makeResponse() as unknown as Response;
    const next = vi.fn();

    requireRoles(['Administrator'])(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('denies a user whose role is not allowed', () => {
    const req: any = { user: { role: 'User' } };
    const res = makeResponse() as unknown as Response;
    const next = vi.fn();

    requireRoles(['Administrator', 'Cloud Engineer'])(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Insufficient permissions',
      code: 'FORBIDDEN',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 when no user is attached to the request', () => {
    const req: any = {};
    const res = makeResponse() as unknown as Response;
    const next = vi.fn();

    requireRoles(['Administrator'])(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Authentication required',
      code: 'UNAUTHORIZED',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when the user role is missing', () => {
    const req: any = { user: {} };
    const res = makeResponse() as unknown as Response;
    const next = vi.fn();

    requireRoles(['Administrator'])(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Insufficient permissions',
      code: 'FORBIDDEN',
    });
    expect(next).not.toHaveBeenCalled();
  });
});
