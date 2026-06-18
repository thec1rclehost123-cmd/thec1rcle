declare module '@sentry/react-native' {
  export interface ReactNativeOptions {
    dsn?: string;
    enabled?: boolean;
    environment?: string;
    release?: string;
    tracesSampleRate?: number;
    debug?: boolean;
  }

  export function init(options: ReactNativeOptions): void;
  export function captureException(
    error: unknown,
    context?: { extra?: Record<string, unknown> },
  ): void;
  export function setTag(key: string, value: string): void;
  export function setUser(
    user: { id?: string | null; email?: string | null; username?: string | null } | null,
  ): void;
}
