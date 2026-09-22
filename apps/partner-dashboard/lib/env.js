import { z } from 'zod';

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  GATEWAY_URL: z.string().url().optional(),
  // C1RCLE-BACKEND gateway (standalone repo) — V2 rewrites target this while
  // the legacy in-repo gateway keeps serving /api/v1.
  V2_GATEWAY_URL: z.string().url().optional(),
  SENTRY_ORG: z.string().optional(),
  SENTRY_PROJECT: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  PUBLIC_API_URL: z.string().url().optional(),
  INTERNAL_API_KEY: z.string().optional(),
  QR_SECRET_KEY: z.string().optional().default('c1rcle-qr-secret-2024'),
  IDEOGRAM_API_KEY: z.string().optional(),
  FIREBASE_STORAGE_BUCKET: z.string().optional(),
});

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SENTRY_DSN: z.string().optional().or(z.literal('')),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
  NEXT_PUBLIC_GUEST_PORTAL_URL: z.string().url().optional(),
  NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
  NEXT_PUBLIC_DEFAULT_CITY: z.string().optional().default('Pune'),
  // T21 feature-flag: when "true" the V2 partner slice is enabled for
  // partners (V2 Studio route, /api/v2 rewrites). Defaults to off so the
  // V1 surface stays the default for the one release during the switch.
  NEXT_PUBLIC_V2_ENABLED: z.enum(['true', 'false']).default('false'),
});

const _serverEnv = serverEnvSchema.safeParse(process.env);
const _clientEnv = clientEnvSchema.safeParse({
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_GUEST_PORTAL_URL: process.env.NEXT_PUBLIC_GUEST_PORTAL_URL,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  NEXT_PUBLIC_DEFAULT_CITY: process.env.NEXT_PUBLIC_DEFAULT_CITY,
  NEXT_PUBLIC_V2_ENABLED: process.env.NEXT_PUBLIC_V2_ENABLED,
});

if (!process.env.SKIP_ENV_VALIDATION) {
  if (!_serverEnv.success || !_clientEnv.success) {
    console.error('❌ Invalid environment variables in partner-dashboard');
    if (!_serverEnv.success) console.error(_serverEnv.error.format());
    if (!_clientEnv.success) console.error(_clientEnv.error.format());
    process.exit(1);
  }
}

export const env = { ...(_serverEnv.data ?? {}), ...(_clientEnv.data ?? {}) };
