import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { User } from '../models/User';

export interface AuthenticatedUser {
    id: string;
    sub: string;     // alias for id — kept for backward compat
    email: string;
    name: string;
    role: string;
}

export interface AuthRequest extends Request {
    user?: AuthenticatedUser;
}

export const authenticateToken = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
): Promise<void> => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        res.status(401).json({ success: false, message: 'Authentication required', code: 'UNAUTHORIZED' });
        return;
    }

    let decoded: any;
    try {
        decoded = jwt.verify(token, env.JWT_SECRET);
    } catch {
        res.status(401).json({ success: false, message: 'Invalid or expired token', code: 'UNAUTHORIZED' });
        return;
    }

    const userId = decoded.sub as string;
    if (!userId) {
        res.status(401).json({ success: false, message: 'Invalid token payload', code: 'UNAUTHORIZED' });
        return;
    }

    // If the JWT already contains enriched fields (Phase 14+ tokens), use them directly.
    // Otherwise fall back to a MongoDB lookup for older tokens (backward compat).
    if (decoded.email && decoded.name && decoded.role) {
        req.user = {
            id: userId,
            sub: userId,
            email: decoded.email,
            name: decoded.name,
            role: decoded.role,
        };
        return next();
    }

    // Backward compat: old token only has {sub, role} — load user from DB
    try {
        const dbUser: any = await User.findById(userId).populate('role').lean();
        if (!dbUser || !dbUser.is_active) {
            res.status(401).json({ success: false, message: 'User not found or inactive', code: 'UNAUTHORIZED' });
            return;
        }
        req.user = {
            id: userId,
            sub: userId,
            email: dbUser.email,
            name: dbUser.name,
            role: (dbUser.role as any)?.name || decoded.role || 'User',
        };
        return next();
    } catch {
        res.status(401).json({ success: false, message: 'Could not authenticate user', code: 'UNAUTHORIZED' });
    }
};
