/**
 * Structured logger for partner-dashboard API routes.
 *
 * In production: emits JSON lines (compatible with Cloud Logging / Datadog).
 * In development: emits human-readable coloured output.
 *
 * Usage:
 *   import { logger } from "@/lib/server/logger";
 *   logger.error("events/create", "Failed to create event", { eventId, uid });
 *   logger.warn("withAuth", "Token expired", { path });
 *   logger.info("events/create", "Event created", { eventId });
 */

type LogLevel = "info" | "warn" | "error";

interface LogEntry {
    level: LogLevel;
    route: string;
    message: string;
    ts: string;
    env: string;
    [key: string]: unknown;
}

const isProd = process.env.NODE_ENV === "production";

function emit(level: LogLevel, route: string, message: string, context?: Record<string, unknown>) {
    const entry: LogEntry = {
        level,
        route,
        message,
        ts: new Date().toISOString(),
        env: process.env.NODE_ENV ?? "development",
        ...context,
    };

    if (isProd) {
        // JSON line — parseable by Cloud Logging, Datadog, etc.
        const consoleFn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
        consoleFn(JSON.stringify(entry));
    } else {
        // Human-readable dev output
        const prefix = level === "error" ? "❌" : level === "warn" ? "⚠️ " : "ℹ️ ";
        const ctxStr = context && Object.keys(context).length ? ` ${JSON.stringify(context)}` : "";
        const consoleFn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
        consoleFn(`${prefix} [${route}] ${message}${ctxStr}`);
    }
}

export const logger = {
    info: (route: string, message: string, context?: Record<string, unknown>) =>
        emit("info", route, message, context),
    warn: (route: string, message: string, context?: Record<string, unknown>) =>
        emit("warn", route, message, context),
    error: (route: string, message: string, context?: Record<string, unknown>) =>
        emit("error", route, message, context),
};
