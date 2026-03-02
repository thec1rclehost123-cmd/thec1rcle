import { z } from 'zod';

const serverEnvSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    SENTRY_ORG: z.string().optional(),
    SENTRY_PROJECT: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),
    PUBLIC_API_URL: z.string().url().optional(),
    INTERNAL_API_KEY: z.string().optional(),
    TICKET_SECRET: z.string().optional().default('c1rcle-secret-2025'),
    MSG91_AUTH_KEY: z.string().optional(),
    MSG91_TEMPLATE_ID: z.string().optional(),
    FIREBASE_PRIVATE_KEY: z.string().optional(),
    FIREBASE_CLIENT_EMAIL: z.string().optional(),
    FIREBASE_PROJECT_ID: z.string().optional(),
});

const clientEnvSchema = z.object({
    NEXT_PUBLIC_SENTRY_DSN: z.string().optional().or(z.literal('')),
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().optional(),
    NEXT_PUBLIC_DEFAULT_CITY: z.string().optional().default('Pune'),
    NEXT_PUBLIC_GATEWAY_URL: z.string().url().optional(),
});

const _serverEnv = serverEnvSchema.safeParse(process.env);
const _clientEnv = clientEnvSchema.safeParse({
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_DEFAULT_CITY: process.env.NEXT_PUBLIC_DEFAULT_CITY,
    NEXT_PUBLIC_GATEWAY_URL: process.env.NEXT_PUBLIC_GATEWAY_URL,
});

if (!_serverEnv.success || !_clientEnv.success) {
    console.error('❌ Invalid environment variables');
    if (!_serverEnv.success) console.error(_serverEnv.error.format());
    if (!_clientEnv.success) console.error(_clientEnv.error.format());
    process.exit(1);
}

export const env = { ..._serverEnv.data, ..._clientEnv.data };
