import * as Sentry from '@sentry/nextjs';

const REQUIRED_ENV_VARS = ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'];

export function register() {
  // Validate critical server-side env vars on startup so misconfigured
  // deployments fail loudly at boot rather than silently at runtime.
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const missing = REQUIRED_ENV_VARS.filter((k) => !process.env[k]);
    if (missing.length > 0) {
      console.error(
        JSON.stringify({
          level: 'error',
          route: 'instrumentation',
          message: 'CRITICAL: Missing required environment variables',
          missing,
          ts: new Date().toISOString(),
        }),
      );
      // In production, crash fast — a misconfigured admin console is a security risk.
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
    }

    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || '',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      debug: false,
      environment: process.env.NODE_ENV || 'development',
    });
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || '',
      tracesSampleRate: 1,
      debug: false,
    });
  }
}
