import { z } from 'zod';

const serverEnvSchema = z.object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    SENTRY_ORG: z.string().optional(),
    SENTRY_PROJECT: z.string().optional(),
    RESEND_API_KEY: z.string().optional(),
    PUBLIC_API_URL: z.string().url().optional(),
    INTERNAL_API_KEY: z.string().optional(),
    RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
    APPLE_PASS_TYPE_ID: z.string().optional(),
    APPLE_PASS_TEAM_ID: z.string().optional(),
    APPLE_PASS_CERT_PATH: z.string().optional(),
    GOOGLE_WALLET_ISSUER_ID: z.string().optional(),
    GOOGLE_WALLET_SERVICE_ACCOUNT_KEY: z.string().optional(),
    FIREBASE_PROJECT_ID: z.string().optional(),
    FIREBASE_CLIENT_EMAIL: z.string().optional(),
    FIREBASE_PRIVATE_KEY: z.string().optional(),
}).superRefine((data, ctx) => {
    if (data.NODE_ENV === 'production') {
        if (!data.FIREBASE_PROJECT_ID) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'FIREBASE_PROJECT_ID is required in production', path: ['FIREBASE_PROJECT_ID'] });
        if (!data.FIREBASE_CLIENT_EMAIL) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'FIREBASE_CLIENT_EMAIL is required in production', path: ['FIREBASE_CLIENT_EMAIL'] });
        if (!data.FIREBASE_PRIVATE_KEY) ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'FIREBASE_PRIVATE_KEY is required in production', path: ['FIREBASE_PRIVATE_KEY'] });
    }
});

const clientEnvSchema = z.object({
    NEXT_PUBLIC_SENTRY_DSN: z.string().optional().or(z.literal('')),
    NEXT_PUBLIC_GATEWAY_URL: z.string().url().optional(),
    NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
    NEXT_PUBLIC_DEFAULT_CITY: z.string().optional().default('Pune'),
    NEXT_PUBLIC_ALGOLIA_APP_ID: z.string().optional(),
    NEXT_PUBLIC_ALGOLIA_SEARCH_KEY: z.string().optional(),
});

const _serverEnv = serverEnvSchema.safeParse(process.env);
const _clientEnv = clientEnvSchema.safeParse({
    NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
    NEXT_PUBLIC_GATEWAY_URL: process.env.NEXT_PUBLIC_GATEWAY_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_DEFAULT_CITY: process.env.NEXT_PUBLIC_DEFAULT_CITY,
    NEXT_PUBLIC_ALGOLIA_APP_ID: process.env.NEXT_PUBLIC_ALGOLIA_APP_ID,
    NEXT_PUBLIC_ALGOLIA_SEARCH_KEY: process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY,
});

if (!_serverEnv.success || !_clientEnv.success) {
    console.error('❌ Invalid environment variables in guest-portal');
    if (!_serverEnv.success) console.error(_serverEnv.error.format());
    if (!_clientEnv.success) console.error(_clientEnv.error.format());
    process.exit(1);
}

export const env = { ..._serverEnv.data, ..._clientEnv.data };
