import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
    PORT: z.string().default('8000'),
    MONGODB_URI: z.string().min(1),
    JWT_SECRET: z.string().min(1),
    JWT_REFRESH_SECRET: z.string().min(1),
    TOKEN_EXPIRY: z.string().default('1h'),
    REFRESH_EXPIRY: z.string().default('7d'),
    CORS_ORIGIN: z.string().default('http://localhost:5173'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
    console.error('Invalid environment variables:\n', _env.error.format());
    process.exit(1);
}

export const env = _env.data;
