import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';

export const errorHandler = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
): void => {
    // Never expose stack traces in production
    if (process.env.NODE_ENV !== 'production') {
        console.error('[ERROR]', err.stack ?? err.message ?? err);
    } else {
        console.error('[ERROR]', err.message ?? 'Internal Server Error');
    }

    // Zod validation errors
    if (err instanceof z.ZodError) {
        res.status(422).json({
            success: false,
            message: 'Validation failed',
            code: 'VALIDATION_ERROR',
            errors: err.errors.map(e => ({
                field: e.path.join('.'),
                message: e.message,
            })),
        });
        return;
    }

    // JWT errors
    if (err.name === 'UnauthorizedError' || err.name === 'JsonWebTokenError') {
        res.status(401).json({ success: false, message: 'Invalid token', code: 'UNAUTHORIZED' });
        return;
    }

    // Mongoose duplicate key
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue ?? {})[0] ?? 'field';
        res.status(409).json({ success: false, message: `Duplicate value for ${field}`, code: 'CONFLICT' });
        return;
    }

    // Default 500
    res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'production' ? 'Internal Server Error' : (err.message ?? 'Internal Server Error'),
        code: 'INTERNAL_ERROR',
    });
};
