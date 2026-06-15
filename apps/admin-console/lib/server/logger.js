/**
 * Structured logger for admin-console API routes.
 *
 * Every log entry enforces a strict schema:
 *   { level, app, route, message, ts, env, requestId?, uid?, ip?, ...context }
 *
 * Production: JSON lines — readable by Google Cloud Logging, Datadog, Loki.
 * Development: human-readable coloured output.
 *
 * Usage:
 *   import { logger, logAdminAction, logAuthEvent, logRateLimit, getRequestId } from "@/lib/server/logger";
 *
 *   const requestId = getRequestId(req);
 *   logAdminAction("USER_BAN", { requestId, adminId, adminRole, targetId });
 *   logAuthEvent("UNAUTHORIZED_ADMIN_ACCESS", { requestId, uid, ip, path });
 */

import * as Sentry from '@sentry/nextjs';
import { randomUUID } from 'node:crypto';

const isProd = process.env.NODE_ENV === 'production';
const APP = 'admin-console';

// ── Request ID helper ────────────────────────────────────────────────────────

/**
 * Extract or generate a requestId.
 * Reads x-request-id (from API Gateway / Vercel edge) or generates a fresh UUID.
 * @param {Request} request
 * @returns {string}
 */
export function getRequestId(request) {
  if (!request) return randomUUID();
  const fromHeader = request.headers?.get?.('x-request-id');
  return fromHeader || randomUUID();
}

// ── Core emit ────────────────────────────────────────────────────────────────

function emit(level, route, message, context = {}) {
  const entry = {
    level,
    app: APP,
    route,
    message,
    ts: new Date().toISOString(),
    env: process.env.NODE_ENV ?? 'development',
    ...(context.requestId && { requestId: context.requestId }),
    ...(context.uid && { uid: context.uid }),
    ...(context.ip && { ip: context.ip }),
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
  info: (route, message, context) => emit('info', route, message, context),
  warn: (route, message, context) => emit('warn', route, message, context),
  error: (route, message, context) => emit('error', route, message, context),
};

// ── Security Event Helpers ───────────────────────────────────────────────────

const CRITICAL_ACTIONS = new Set([
  'DATABASE_CORRECTION',
  'ADMIN_PROVISION',
  'FINANCIAL_REFUND',
  'PAYOUT_BATCH_RUN',
]);

/**
 * Log an admin action — every mutation through actions/route.js calls this.
 * @param {string} action
 * @param {{ requestId?: string, adminId: string, adminRole: string, targetId: string }} context
 */
export function logAdminAction(action, context = {}) {
  const entry = { securityEvent: 'ADMIN_ACTION', action, ...context };
  emit(CRITICAL_ACTIONS.has(action) ? 'error' : 'warn', 'security/admin-action', action, entry);

  // Every admin action is Sentry-visible; critical ones are errors
  Sentry.captureEvent({
    message: `[Admin] ${action}`,
    level: CRITICAL_ACTIONS.has(action) ? 'error' : 'warning',
    extra: entry,
    tags: { securityEvent: 'ADMIN_ACTION', action, app: APP },
  });
}

/**
 * Log an authentication security event.
 * Every admin auth failure is Sentry-worthy (unlike guest-portal where only high-severity ones are).
 * @param {string} eventType
 * @param {{ requestId?: string, uid?: string, ip?: string, path?: string }} context
 */
export function logAuthEvent(eventType, context = {}) {
  const entry = { securityEvent: 'AUTH', eventType, ...context };
  emit('warn', 'security/auth', eventType, entry);

  Sentry.captureEvent({
    message: `[Security/Auth/Admin] ${eventType}`,
    level: 'warning',
    extra: entry,
    tags: { securityEvent: 'AUTH', app: APP },
  });
}

/**
 * Log a rate limit hit on admin routes.
 * @param {{ requestId?: string, adminId?: string, ip?: string, path?: string }} context
 */
export function logRateLimit(context = {}) {
  const entry = { securityEvent: 'RATE_LIMIT', eventType: 'RATE_LIMIT_HIT', ...context };
  emit('warn', 'security/rate-limit', 'Rate limit exceeded on admin route', entry);

  Sentry.captureEvent({
    message: '[Security/RateLimit] Admin route rate limited',
    level: 'warning',
    extra: entry,
    tags: { securityEvent: 'RATE_LIMIT', app: APP },
  });
}
