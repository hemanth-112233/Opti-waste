import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { errorHandler } from '../../../middleware/errorHandler';

const makeResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn().mockReturnThis(),
});

describe('errorHandler', () => {
  it('maps Zod validation errors to a 422 response', () => {
    const res = makeResponse();
    const err = new z.ZodError([
      {
        code: 'invalid_type',
        expected: 'string',
        received: 'number',
        path: ['name'],
        message: 'Expected string, received number',
      } as any,
    ]);

    errorHandler(err, {} as any, res as any, vi.fn());

    expect(res.status).toHaveBeenCalledWith(422);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Validation failed',
      code: 'VALIDATION_ERROR',
      errors: [{ field: 'name', message: 'Expected string, received number' }],
    });
  });

  it('maps JWT errors to a 401 response', () => {
    const res = makeResponse();
    const err = { name: 'JsonWebTokenError', message: 'bad token' };

    errorHandler(err as any, {} as any, res as any, vi.fn());

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Invalid token',
      code: 'UNAUTHORIZED',
    });
  });

  it('maps Mongo duplicate key errors to a 409 response', () => {
    const res = makeResponse();
    const err = {
      code: 11000,
      keyValue: { email: 'duplicate@example.com' },
      message: 'duplicate key error',
    };

    errorHandler(err as any, {} as any, res as any, vi.fn());

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Duplicate value for email',
      code: 'CONFLICT',
    });
  });

  it('maps generic errors to a 500 response', () => {
    const res = makeResponse();
    const err = { message: 'Something went wrong' };

    errorHandler(err as any, {} as any, res as any, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Something went wrong',
      code: 'INTERNAL_ERROR',
    });
  });
});
