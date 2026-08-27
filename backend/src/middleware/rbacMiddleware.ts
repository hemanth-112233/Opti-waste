import { Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';

/**
 * All role names are normalized to lowercase for comparison
 * to avoid mismatches like 'Admin' vs 'Administrator'.
 *
 * Canonical role names in the system:
 *   Administrator, Cloud Engineer, Analyst, User
 */
export const requireRoles = (roles: string[]) => {
    const allowedLower = roles.map(r => r.toLowerCase());

    return (req: AuthRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({ success: false, message: 'Authentication required', code: 'UNAUTHORIZED' });
            return;
        }

        const userRole = req.user.role?.toLowerCase() ?? '';

        // 'admin' is an alias for 'administrator' for backward compat
        const normalizedRole = userRole === 'admin' ? 'administrator' : userRole;

        if (!allowedLower.includes(normalizedRole)) {
            res.status(403).json({ success: false, message: 'Insufficient permissions', code: 'FORBIDDEN' });
            return;
        }

        next();
    };
};
