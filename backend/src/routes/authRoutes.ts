import { Router } from 'express';
import { AuthService, ROLES } from '../services/AuthService';
import { User } from '../models/User';
import { z } from 'zod';
import { validate } from '../middleware/validationMiddleware';
import { authenticateToken, AuthRequest } from '../middleware/authMiddleware';

const router = Router();

/* ══════════════════ Validation schemas ══════════════════ */

const loginSchema = z.object({
    // Accept both 'email' (frontend) and 'username' (legacy OAuth2 compat)
    email: z.string().email().optional(),
    username: z.string().optional(),
    password: z.string().min(1),
}).refine(d => d.email || d.username, {
    message: 'email or username is required',
    path: ['email'],
});

const signupSchema = z.object({
    name: z.string().min(1, 'Name is required').max(100),
    email: z.string().email('Invalid email address'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
});

const refreshSchema = z.object({
    refresh_token: z.string().min(1),
});

/* ══════════════════ POST /auth/login ════════════════════ */

router.post('/login', validate(loginSchema), async (req, res, next) => {
    try {
        // Normalize: accept email or username (OAuth2 legacy)
        const rawEmail = (req.body.email || req.body.username || '').trim().toLowerCase();
        const { password } = req.body;

        const result = await AuthService.authenticateUser(rawEmail, password);

        if (!result) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password',
                code: 'UNAUTHORIZED',
            });
        }

        return res.json({
            success: true,
            access_token: result.tokens.access_token,
            refresh_token: result.tokens.refresh_token,
            token_type: result.tokens.token_type,
            user: result.user,
        });
    } catch (err) { next(err); }
});

/* ══════════════════ POST /auth/signup / /register ═══════ */

const handleSignup = async (req: any, res: any, next: any) => {
    try {
        const { name, password } = req.body;
        const email = req.body.email.trim().toLowerCase();

        const exists = await User.findOne({ email });
        if (exists) {
            return res.status(400).json({
                success: false,
                message: 'An account with this email already exists',
                code: 'CONFLICT',
            });
        }

        const hash = await AuthService.hashPassword(password);

        // Ensure roles exist in DB
        await AuthService.seedDefaultRoles();

        // First user registered on a fresh install becomes Administrator;
        // every subsequent user gets the default 'User' role.
        const existingUserCount = await User.countDocuments();
        const isFirstUser = existingUserCount === 0;

        const assignedRole = isFirstUser
            ? await import('../models/Role').then(({ Role }) =>
                Role.findOne({ name: ROLES.ADMINISTRATOR })
            )
            : await AuthService.getUserRole();

        const user = new User({
            name: name.trim(),
            email,
            password_hash: hash,
            role: assignedRole?._id,
            is_active: true,
        });
        await user.save();

        return res.status(201).json({
            success: true,
            message: isFirstUser
                ? 'Administrator account created successfully'
                : 'Account created successfully',
        });
    } catch (err) { next(err); }
};

router.post('/register', validate(signupSchema), handleSignup);
router.post('/signup', validate(signupSchema), handleSignup);

/* ══════════════════ GET /auth/me ════════════════════════ */

router.get('/me', authenticateToken, async (req: AuthRequest, res, next) => {
    try {
        if (!req.user) {
            return res.status(401).json({ success: false, message: 'Not authenticated', code: 'UNAUTHORIZED' });
        }

        // Always fetch fresh from DB to guarantee accuracy
        const dbUser: any = await User.findById(req.user.id).populate('role').lean();
        if (!dbUser) {
            return res.status(401).json({ success: false, message: 'User not found', code: 'UNAUTHORIZED' });
        }

        return res.json({
            success: true,
            user: {
                id: dbUser._id.toString(),
                name: dbUser.name,
                email: dbUser.email,
                role: (dbUser.role as any)?.name || req.user.role,
                avatar: null,
            },
        });
    } catch (err) { next(err); }
});

/* ══════════════════ POST /auth/refresh ══════════════════ */

router.post('/refresh', validate(refreshSchema), async (req, res, next) => {
    try {
        const { refresh_token } = req.body;
        const dbUser: any = await AuthService.verifyRefreshToken(refresh_token);

        if (!dbUser) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired refresh token',
                code: 'UNAUTHORIZED',
            });
        }

        const roleName: string = (dbUser.role as any)?.name ?? ROLES.USER;
        const tokens = AuthService.generateTokens(
            dbUser._id.toString(),
            roleName,
            dbUser.email,
            dbUser.name,
        );

        return res.json({
            success: true,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
            token_type: tokens.token_type,
            user: {
                id: dbUser._id.toString(),
                name: dbUser.name,
                email: dbUser.email,
                role: roleName,
                avatar: null,
            },
        });
    } catch (err) { next(err); }
});

/* ══════════════════ POST /auth/setup-admin ══════════════ */
/**
 * One-time account promotion for development / fresh-install scenarios.
 * Protected by the ADMIN_SETUP_SECRET environment variable.
 * • If ADMIN_SETUP_SECRET is not set → 404 (endpoint is inactive).
 * • If secret matches → the named user account is promoted to Administrator.
 * • The user must then log out and back in so a new JWT is issued with the
 *   updated role.
 *
 * Example (curl):
 *   POST /api/v1/auth/setup-admin
 *   { "email": "you@example.com", "secret": "<ADMIN_SETUP_SECRET value>" }
 */
router.post('/setup-admin', async (req, res, next) => {
    try {
        const expectedSecret = process.env.ADMIN_SETUP_SECRET;

        // Endpoint is disabled if no secret is configured
        if (!expectedSecret) {
            return res.status(404).json({ success: false, message: 'Not found' });
        }

        const { email, secret } = req.body ?? {};

        if (!secret || secret !== expectedSecret) {
            return res.status(403).json({
                success: false,
                message: 'Invalid setup secret',
                code: 'FORBIDDEN',
            });
        }
        if (!email) {
            return res.status(400).json({ success: false, message: 'email is required' });
        }

        // Ensure canonical roles exist
        await AuthService.seedDefaultRoles();

        const { Role } = await import('../models/Role');
        const adminRole = await Role.findOne({ name: ROLES.ADMINISTRATOR });
        if (!adminRole) {
            return res.status(500).json({ success: false, message: 'Administrator role not found after seeding' });
        }

        const updated: any = await User.findOneAndUpdate(
            { email: email.trim().toLowerCase() },
            { role: adminRole._id },
            { new: true }
        ).populate('role').lean();

        if (!updated) {
            return res.status(404).json({ success: false, message: 'No user found with that email address' });
        }

        return res.json({
            success: true,
            message: `${email} promoted to Administrator. Please log out and log back in to receive an updated token.`,
            role: (updated.role as any)?.name ?? 'Administrator',
        });
    } catch (err) { next(err); }
});

/* ══════════════════ POST /auth/logout ═══════════════════ */

router.post('/logout', async (req, res) => {
    // Stateless JWT — client must discard tokens.
    // If refresh-token DB persistence is added, revoke here.
    return res.json({
        success: true,
        message: 'Logged out successfully',
    });
});

export default router;
