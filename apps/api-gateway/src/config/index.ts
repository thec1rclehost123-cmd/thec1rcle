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
    FIREBASE_STORAGE_BUCKET: z.string().optional(),
    REDIS_URL: z.string().url().default('redis://localhost:6379'),
    SENTRY_DSN: z.string().url().optional().or(z.literal('')),
    RAZORPAY_KEY_ID: z.string().optional(),
    RAZORPAY_KEY_SECRET: z.string().optional(),
    RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
    MEILISEARCH_HOST: z.string().url().default('http://localhost:7700'),
    MEILISEARCH_API_KEY: z.string().optional(),
    MEILISEARCH_MASTER_KEY: z.string().optional(),
    TICKET_SECRET: z.string().min(1).default('c1rcle-dev-ticket-secret'),
    QR_SECRET_KEY: z.string().optional(),
    QUEUE_SECRET_KEY: z.string().min(1).default('c1rcle-dev-surge-protection'),
    SCANNER_SESSION_SECRET: z.string().optional(),
    DEV_TOY_MODE: z.enum(['true', 'false']).default('false'),
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

if (_env.data.NODE_ENV === 'production') {
    const DEV_DEFAULTS: Record<string, string> = {
        TICKET_SECRET: 'c1rcle-dev-ticket-secret',
        QUEUE_SECRET_KEY: 'c1rcle-dev-surge-protection',
    };
    const violations = Object.entries(DEV_DEFAULTS)
        .filter(([key, devVal]) => (process.env[key] || devVal) === devVal)
        .map(([key]) => key);
    if (violations.length > 0) {
        console.error(`❌ Production secret(s) are using dev defaults: ${violations.join(', ')}. Set real values in env.`);
        process.exit(1);
    }
    const missingSecrets = ['QR_SECRET_KEY', 'SCANNER_SESSION_SECRET']
        .filter((name) => !process.env[name]);
    if (missingSecrets.length > 0) {
        console.error(`❌ Missing required production secrets: ${missingSecrets.join(', ')}`);
        process.exit(1);
    }
}

export const config = _env.data;
export const env = _env.data;
