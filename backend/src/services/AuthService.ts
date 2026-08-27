import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { User } from '../models/User';
import { Role } from '../models/Role';
import { env } from '../config/env';

// Canonical role names used consistently across the system
export const ROLES = {
    ADMINISTRATOR: 'Administrator',
    CLOUD_ENGINEER: 'Cloud Engineer',
    ANALYST: 'Analyst',
    USER: 'User',
} as const;

export class AuthService {
    static generateTokens(userId: string, roleName: string, email: string, name: string) {
        const payload = { sub: userId, role: roleName, email, name };
        const access_token = jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.TOKEN_EXPIRY as any });
        const refresh_token = jwt.sign({ sub: userId }, env.JWT_REFRESH_SECRET, { expiresIn: env.REFRESH_EXPIRY as any });
        return { access_token, refresh_token, token_type: 'Bearer' };
    }

    static async hashPassword(password: string): Promise<string> {
        return await bcrypt.hash(password, 12);
    }

    static async verifyPassword(password: string, hash: string): Promise<boolean> {
        return await bcrypt.compare(password, hash);
    }

    static async authenticateUser(email: string, password: string) {
        const user: any = await User.findOne({ email }).populate('role').lean();
        if (!user) return null;
        if (user.is_active === false) return null;

        const isValid = await this.verifyPassword(password, user.password_hash);
        if (!isValid) return null;

        const roleName: string = (user.role as any)?.name ?? ROLES.USER;
        const tokens = this.generateTokens(
            user._id.toString(),
            roleName,
            user.email,
            user.name
        );

        return {
            user: {
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                role: roleName,
                avatar: null,
            },
            tokens,
        };
    }

    static async verifyRefreshToken(token: string) {
        try {
            const decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as any;
            const userId = decoded.sub as string;
            const dbUser: any = await User.findById(userId).populate('role').lean();
            if (!dbUser || dbUser.is_active === false) return null;
            return dbUser;
        } catch {
            return null;
        }
    }

    static async seedDefaultRoles() {
        const roles = [
            { name: ROLES.ADMINISTRATOR, permissions: ['*'] },
            { name: ROLES.CLOUD_ENGINEER, permissions: ['read', 'write'] },
            { name: ROLES.ANALYST, permissions: ['read'] },
            { name: ROLES.USER, permissions: ['read'] },
        ];

        const results: Record<string, any> = {};
        for (const r of roles) {
            results[r.name] = await Role.findOneAndUpdate(
                { name: r.name },
                { name: r.name, permissions: r.permissions },
                { upsert: true, new: true }
            );
        }
        return results;
    }

    /** Convenience: get User role document */
    static async getUserRole() {
        return Role.findOne({ name: ROLES.USER });
    }
}
