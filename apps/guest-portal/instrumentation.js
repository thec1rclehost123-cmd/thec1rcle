import * as Sentry from '@sentry/nextjs';
import { getGuestApiBaseConfig } from './lib/api/base-url.js';

export function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { apiBaseUrl, sourceKey } = getGuestApiBaseConfig(process.env);
    if (!apiBaseUrl) {
      console.error(
        JSON.stringify({
          level: 'error',
          route: 'instrumentation',
          message: 'CRITICAL: Missing guest API base URL',
          ts: new Date().toISOString(),
        }),
      );
      if (process.env.NODE_ENV === 'production') {
        process.exit(1);
      }
    } else if (process.env.NODE_ENV !== 'production' && sourceKey !== 'GUEST_API_GATEWAY_URL') {
      console.warn(
        JSON.stringify({
          level: 'warn',
          route: 'instrumentation',
          message: 'Using legacy guest API base URL env alias; prefer GUEST_API_GATEWAY_URL',
          sourceKey,
          ts: new Date().toISOString(),
        }),
      );
    }

    if (process.env.NODE_ENV !== 'development') {
      Sentry.init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || '',
        // 10% trace sampling in production — enough for performance insights without quota burn.
        // Errors are always captured regardless of this rate.
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
        debug: false,
        environment: process.env.NODE_ENV || 'development',
      });
    }
  }

  if (process.env.NEXT_RUNTIME === 'edge') {
    if (process.env.NODE_ENV !== 'development') {
      Sentry.init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN || '',
        tracesSampleRate: 1,
        debug: false,
      });
    }
  }
}
