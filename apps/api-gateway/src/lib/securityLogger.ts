/**
 * Security event helpers for the API Gateway.
 *
 * Uses the Fastify request logger so every security event is automatically
 * correlated to the same requestId as the surrounding request.
 *
 * Every entry enforces the standard schema:
 *   { level, app, securityEvent, eventType, requestId, uid, ip, path, ts, ...context }
 *
 * Usage (inside a route handler):
 *   import { logAuthEvent, logPaymentEvent, logScanEvent, logRateLimit } from "@lib/securityLogger";
 *
 *   logAuthEvent(request, "TOKEN_INVALID");
 *   logPaymentEvent(request, "SIGNATURE_MISMATCH", { orderId, uid });
 *   logScanEvent(request, "DUPLICATE_SCAN", { ticketId, eventId });
 *   logRateLimit(request, { uid, ip });
 */

import type { FastifyRequest } from 'fastify';
import * as Sentry from '@sentry/node';

type SecurityContext = Record<string, unknown>;

const APP = 'api-gateway';

const PAYMENT_ANOMALIES = new Set([
  'SIGNATURE_MISMATCH',
  'AMOUNT_TAMPER',
  'ORDER_ID_MISMATCH',
  'REPLAY_ATTACK',
]);
const HIGH_SEVERITY_AUTH = new Set([
  'AUTH_BYPASS_ATTEMPT',
  'TOKEN_FORGERY',
  'SYSTEM_KEY_ABUSE',
  'CREDENTIAL_STUFFING_DETECTED',
  'BRUTE_FORCE_DETECTED',
]);

function getUid(request: FastifyRequest): string | undefined {
  return (request as any).user?.uid;
}

function buildEntry(
  request: FastifyRequest,
  securityEvent: string,
  eventType: string,
  context: SecurityContext,
): Record<string, unknown> {
  return {
    app: APP,
    securityEvent,
    eventType,
    requestId: request.id,
    uid: getUid(request),
    ip: request.ip,
    path: request.url,
    method: request.method,
    ...context,
  };
}

// ── Auth Events ──────────────────────────────────────────────────────────────

export function logAuthEvent(
  request: FastifyRequest,
  eventType: string,
  context: SecurityContext = {},
): void {
  const entry = buildEntry(request, 'AUTH', eventType, context);
  request.log.warn(entry, `[Security/Auth] ${eventType}`);

  if (HIGH_SEVERITY_AUTH.has(eventType)) {
    Sentry.captureEvent({
      message: `[Security/Auth] ${eventType}`,
      level: 'warning',
      extra: entry,
      tags: { securityEvent: 'AUTH', app: APP },
    });
  }
}

// ── Payment Events ───────────────────────────────────────────────────────────

export function logPaymentEvent(
  request: FastifyRequest,
  eventType: string,
  context: SecurityContext = {},
): void {
  const entry = buildEntry(request, 'PAYMENT', eventType, context);
  const isAnomaly = PAYMENT_ANOMALIES.has(eventType);

  if (isAnomaly) {
    request.log.error(entry, `[Security/Payment] ${eventType}`);
    Sentry.captureEvent({
      message: `[Security/Payment] ${eventType}`,
      level: 'error',
      extra: entry,
      tags: { securityEvent: 'PAYMENT', app: APP },
    });
  } else {
    request.log.info(entry, `[Security/Payment] ${eventType}`);
  }
}

// ── Scan Events ──────────────────────────────────────────────────────────────

export function logScanEvent(
  request: FastifyRequest,
  eventType: string,
  context: SecurityContext = {},
): void {
  const entry = buildEntry(request, 'SCAN', eventType, context);
  request.log.warn(entry, `[Security/Scan] ${eventType}`);
}

// ── Rate Limit Events ────────────────────────────────────────────────────────

export function logRateLimit(request: FastifyRequest, context: SecurityContext = {}): void {
  const entry = buildEntry(request, 'RATE_LIMIT', 'RATE_LIMIT_HIT', context);
  request.log.warn(entry, '[Security/RateLimit] Rate limit exceeded');
}
