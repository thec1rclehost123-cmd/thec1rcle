import Constants from 'expo-constants';
import * as Sentry from '@sentry/react-native';

let initialized = false;

function getSentryEnvironment() {
  return process.env.EXPO_PUBLIC_APP_ENV || (__DEV__ ? 'development' : 'production');
}

export function initSentry() {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn || initialized) return Boolean(dsn);

  Sentry.init({
    dsn,
    enabled: true,
    environment: getSentryEnvironment(),
    release: `${Constants.expoConfig?.slug || 'thec1rcle'}@${Constants.expoConfig?.version || '0.0.0'}`,
    tracesSampleRate: __DEV__ ? 0 : 0.1,
    debug: __DEV__ && process.env.EXPO_PUBLIC_SENTRY_DEBUG === 'true',
  });

  Sentry.setTag('app.platform', 'mobile');
  Sentry.setTag('app.version', Constants.expoConfig?.version || 'unknown');
  initialized = true;
  return true;
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (!initialized) {
    initSentry();
  }
  if (!process.env.EXPO_PUBLIC_SENTRY_DSN) return;

  Sentry.captureException(error, context ? { extra: context } : undefined);
}

export function setSentryUser(
  user: { id?: string | null; email?: string | null; username?: string | null } | null,
) {
  if (!initialized) {
    initSentry();
  }
  if (!process.env.EXPO_PUBLIC_SENTRY_DSN) return;

  Sentry.setUser(user);
}

export { Sentry };
