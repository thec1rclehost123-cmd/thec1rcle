/**
 * Structured logger for partner-dashboard API routes.
 *
 * Every log entry enforces a strict schema:
 *   { level, app, route, message, ts, env, requestId?, uid?, ip?, ...context }
 *
 * Production: JSON lines — readable by Google Cloud Logging, Datadog, Loki.
 * Development: human-readable coloured output.
 *
 * Usage:
 *   import { logger, logAuthEvent, logAccessEvent, logFinanceEvent, logRateLimit, getRequestId } from "@/lib/server/logger";
 *
 *   const requestId = getRequestId(req);
 *   logger.error("events/create", "Failed to create event", { requestId, uid });
 *   logAuthEvent("TOKEN_INVALID", { requestId, uid, ip, path });
 *   logAccessEvent("FORBIDDEN_HOST_ACCESS", { requestId, uid, hostId });
 */

import { randomUUID } from 'node:crypto';

type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  app: string;
  route: string;
  message: string;
  ts: string;
  env: string;
  requestId?: string;
  uid?: string;
  ip?: string;
  [key: string]: unknown;
}

const isProd = process.env.NODE_ENV === 'production';
const APP = 'partner-dashboard';

// ── Request ID helper ────────────────────────────────────────────────────────

/**
 * Extract or generate a requestId.
 * Reads x-request-id (from API Gateway / Vercel edge) or generates a fresh UUID.
 */
export function getRequestId(request: Request | null | undefined): string {
  if (!request) return randomUUID();
  const fromHeader = (request as any).headers?.get?.('x-request-id');
  return fromHeader || randomUUID();
}

// ── Core emit ────────────────────────────────────────────────────────────────

function emit(
  level: LogLevel,
  route: string,
  message: string,
  context: Record<string, unknown> = {},
): void {
  const entry: LogEntry = {
    level,
    app: APP,
    route,
    message,
    ts: new Date().toISOString(),
    env: process.env.NODE_ENV ?? 'development',
    ...(context.requestId ? { requestId: context.requestId as string } : {}),
    ...(context.uid ? { uid: context.uid as string } : {}),
    ...(context.ip ? { ip: context.ip as string } : {}),
    ...context,
  };

  if (isProd) {
    const consoleFn =
      level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    consoleFn(JSON.stringify(entry));
  } else {
    const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️ ' : 'ℹ️ ';
    const ctxStr = Object.keys(context).length ? ` ${JSON.stringify(context)}` : '';
    const consoleFn =
      level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
    consoleFn(`${prefix} [${APP}/${route}] ${message}${ctxStr}`);
  }
}

export const logger = {
  info: (route: string, message: string, context?: Record<string, unknown>) =>
    emit('info', route, message, context),
  warn: (route: string, message: string, context?: Record<string, unknown>) =>
    emit('warn', route, message, context),
  error: (route: string, message: string, context?: Record<string, unknown>) =>
    emit('error', route, message, context),
};

// ── Security Event Helpers ───────────────────────────────────────────────────

/**
 * Log an authentication security event.
 * @param eventType - e.g. "TOKEN_INVALID", "UNAUTHORIZED_HOST_ACCESS"
 */
export function logAuthEvent(eventType: string, context: Record<string, unknown> = {}): void {
  emit('warn', 'security/auth', eventType, { securityEvent: 'AUTH', eventType, ...context });
}

/**
 * Log a host/venue RBAC access control event.
 * @param eventType - e.g. "FORBIDDEN_HOST_ACCESS", "ROLE_INSUFFICIENT", "MEMBERSHIP_INACTIVE"
 */
export function logAccessEvent(eventType: string, context: Record<string, unknown> = {}): void {
  emit('warn', 'security/access', eventType, { securityEvent: 'ACCESS', eventType, ...context });
}

/**
 * Log a rate limit hit on partner dashboard routes.
 */
export function logRateLimit(context: Record<string, unknown> = {}): void {
  emit('warn', 'security/rate-limit', 'Rate limit exceeded', {
    securityEvent: 'RATE_LIMIT',
    eventType: 'RATE_LIMIT_HIT',
    ...context,
  });
}

/**
 * Log a finance / payout event.
 * @param eventType - e.g. "UNAUTHORIZED_FINANCE_ACCESS", "PAYOUT_REQUESTED"
 */
export function logFinanceEvent(eventType: string, context: Record<string, unknown> = {}): void {
  emit('warn', 'security/finance', eventType, { securityEvent: 'FINANCE', eventType, ...context });
}
