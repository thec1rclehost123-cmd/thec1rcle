import { z } from 'zod';

export const DEFAULT_FRONTEND_ORIGINS = [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
];

const envSchema = z.object({
    PORT: z.string().optional().default('4000').transform(Number),
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    FIREBASE_PROJECT_ID: z.string().min(1, 'FIREBASE_PROJECT_ID is required'),
    FIREBASE_CLIENT_EMAIL: z.string().optional(),
    FIREBASE_PRIVATE_KEY: z.string().optional(),
    REDIS_URL: z.string().url().default('redis://localhost:6379'),
    SENTRY_DSN: z.string().url().optional().or(z.literal('')),
    RAZORPAY_KEY_ID: z.string().optional(),
    RAZORPAY_KEY_SECRET: z.string().optional(),
    QR_SECRET_KEY: z.string().optional().default('c1rcle-qr-secret-2024'),
    FRONTEND_URLS: z
        .string()
        .optional()
        .default(DEFAULT_FRONTEND_ORIGINS.join(','))
        .describe('Comma separated trusted CORS origins'),
});

const _env = envSchema.safeParse(process.env);

if (!_env.success) {
    console.error('❌ Invalid environment variables:', _env.error.format());
    process.exit(1);
}

export const config = _env.data;
export const env = _env.data;
