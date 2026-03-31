/**
 * Structured logger for guest-portal API routes.
 *
 * Every log entry enforces a strict schema:
 *   { level, app, route, message, ts, env, requestId?, uid?, ip?, ...context }
 *
 * Production: JSON lines — readable by Google Cloud Logging, Datadog, Loki.
 * Development: human-readable coloured output.
 *
 * Usage:
 *   import { logger, logAuthEvent, logPaymentEvent, logRateLimit, logScanEvent, getRequestId } from "@/lib/server/logger";
 *
 *   const requestId = getRequestId(request);
 *   logger.error("auth/verify", "Token failed", { requestId, uid, ip });
 *   logAuthEvent("TOKEN_INVALID", { requestId, uid, ip, path });
 *   logPaymentEvent("SIGNATURE_MISMATCH", { requestId, orderId, uid, ip });
 */

import * as Sentry from "@sentry/nextjs";
import { randomUUID } from "node:crypto";

const isProd = process.env.NODE_ENV === "production";
// app tag — always present so multi-app log streams can be filtered
const APP = "guest-portal";

// ── Request ID helper ────────────────────────────────────────────────────────

/**
 * Extract requestId from the incoming request.
 * Reads x-request-id (set by API Gateway or Vercel) or generates a fresh UUID.
 * Pass this into every log call so events can be correlated across services.
 *
 * @param {Request} request
 * @returns {string}
 */
export function getRequestId(request) {
    if (!request) return randomUUID();
    const fromHeader = request.headers?.get?.("x-request-id");
    return fromHeader || randomUUID();
}

// ── Core emit ────────────────────────────────────────────────────────────────

/**
 * @param {"info"|"warn"|"error"} level
 * @param {string} route
 * @param {string} message
 * @param {Record<string, unknown>} context
 */
function emit(level, route, message, context = {}) {
    const entry = {
        // Required schema fields — always present
        level,
        app: APP,
        route,
        message,
        ts: new Date().toISOString(),
        env: process.env.NODE_ENV ?? "development",
        // Optional but standard fields — from context if provided
        ...(context.requestId && { requestId: context.requestId }),
        ...(context.uid       && { uid: context.uid }),
        ...(context.ip        && { ip: context.ip }),
        // All other context fields
        ...context,
    };

    if (isProd) {
        const consoleFn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
        consoleFn(JSON.stringify(entry));
    } else {
        const prefix = level === "error" ? "❌" : level === "warn" ? "⚠️ " : "ℹ️ ";
        const ctxStr = Object.keys(context).length ? ` ${JSON.stringify(context)}` : "";
        const consoleFn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
        consoleFn(`${prefix} [${APP}/${route}] ${message}${ctxStr}`);
    }
}

export const logger = {
    info:  (route, message, context) => emit("info",  route, message, context),
    warn:  (route, message, context) => emit("warn",  route, message, context),
    error: (route, message, context) => emit("error", route, message, context),
};

// ── Security Event Helpers ───────────────────────────────────────────────────

const HIGH_SEVERITY_AUTH = new Set([
    "AUTH_BYPASS_ATTEMPT", "TOKEN_FORGERY", "ADMIN_IMPERSONATION",
    "CREDENTIAL_STUFFING_DETECTED", "BRUTE_FORCE_DETECTED",
]);
const PAYMENT_ANOMALIES = new Set([
    "SIGNATURE_MISMATCH", "AMOUNT_TAMPER", "ORDER_ID_MISMATCH", "REPLAY_ATTACK",
]);

/**
 * Log an authentication security event.
 * @param {string} eventType
 * @param {{ requestId?: string, uid?: string, ip?: string, path?: string }} context
 */
export function logAuthEvent(eventType, context = {}) {
    const entry = { securityEvent: "AUTH", eventType, ...context };
    emit("warn", "security/auth", eventType, entry);

    if (HIGH_SEVERITY_AUTH.has(eventType)) {
        Sentry.captureEvent({
            message: `[Security/Auth] ${eventType}`,
            level: "warning",
            extra: entry,
            tags: { securityEvent: "AUTH", app: APP },
        });
    }
}

/**
 * Log a payment security event.
 * @param {string} eventType
 * @param {{ requestId?: string, orderId?: string, amount?: number, uid?: string, ip?: string }} context
 */
export function logPaymentEvent(eventType, context = {}) {
    const entry = { securityEvent: "PAYMENT", eventType, ...context };
    const isAnomaly = PAYMENT_ANOMALIES.has(eventType);
    emit(isAnomaly ? "error" : "info", "security/payment", eventType, entry);

    if (isAnomaly) {
        Sentry.captureEvent({
            message: `[Security/Payment] ${eventType}`,
            level: "error",
            extra: entry,
            tags: { securityEvent: "PAYMENT", app: APP },
        });
    }
}

/**
 * Log a rate limit hit.
 * @param {{ requestId?: string, uid?: string, ip?: string, path?: string }} context
 */
export function logRateLimit(context = {}) {
    const entry = { securityEvent: "RATE_LIMIT", eventType: "RATE_LIMIT_HIT", ...context };
    emit("warn", "security/rate-limit", "Rate limit exceeded", entry);
}

/**
 * Log a ticket scan security event.
 * @param {string} eventType
 * @param {{ requestId?: string, ticketId?: string, eventId?: string, scannerId?: string }} context
 */
export function logScanEvent(eventType, context = {}) {
    const entry = { securityEvent: "SCAN", eventType, ...context };
    emit("warn", "security/scan", eventType, entry);
}
