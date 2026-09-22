import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { validate, validateQuery } from '../../../middleware/validationMiddleware';

describe('validationMiddleware', () => {
  it('passes valid request bodies through unchanged after parsing', () => {
    const req: any = {
      body: { name: 'Alice', age: 25 },
    };
    const res: any = {};
    const next = vi.fn();
    const schema = z.object({ name: z.string(), age: z.number().int().min(18) });

    validate(schema)(req, res, next);

    expect(req.body).toEqual({ name: 'Alice', age: 25 });
    expect(next).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalledWith();
  });

  it('passes validation errors to next() for invalid body data', () => {
    const req: any = {
      body: { name: 123 },
    };
    const res: any = {};
    const next = vi.fn();
    const schema = z.object({ name: z.string().min(1) });

    validate(schema)(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(z.ZodError);
  });

  it('passes valid query data through after parsing', () => {
    const req: any = {
      query: { page: '2' },
    };
    const res: any = {};
    const next = vi.fn();
    const schema = z.object({ page: z.string().regex(/\d+/) });

    validateQuery(schema)(req, res, next);

    expect(req.query).toEqual({ page: '2' });
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('passes validation errors to next() for invalid query data', () => {
    const req: any = {
      query: { page: 'abc' },
    };
    const res: any = {};
    const next = vi.fn();
    const schema = z.object({ page: z.string().regex(/\d+/) });

    validateQuery(schema)(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(next.mock.calls[0][0]).toBeInstanceOf(z.ZodError);
  });
});
