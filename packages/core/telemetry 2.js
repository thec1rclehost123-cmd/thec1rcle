import * as Sentry from "@sentry/node";
import pino from "pino";

// Initialize Pino
const logger = pino({
    level: process.env.LOG_LEVEL || "info",
    transport: process.env.NODE_ENV !== "production" ? {
        target: "pino-pretty",
        options: {
            translateTime: "HH:MM:ss Z",
            ignore: "pid,hostname",
        },
    } : undefined,
});

// Initialize Sentry for background workers
if (process.env.SENTRY_DSN) {
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || "development",
        tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    });
}

/**
 * Unified Telemetry Utility
 */
export const telemetry = {
    log: logger,
    
    /**
     * Capture an error and report to Sentry if available
     */
    error: (message, error, context = {}) => {
        logger.error({ err: error, ...context }, message);
        
        if (process.env.SENTRY_DSN) {
            Sentry.withScope((scope) => {
                if (context.userId) scope.setUser({ id: context.userId });
                if (context.requestId) scope.setTag("requestId", context.requestId);
                Object.entries(context).forEach(([key, value]) => {
                    if (key !== 'userId' && key !== 'requestId') {
                        scope.setExtra(key, value);
                    }
                });
                Sentry.captureException(error);
            });
        }
    },

    /**
     * Track a specific event or milestone
     */
    track: (name, data = {}) => {
        logger.info({ event: name, ...data }, `[Event] ${name}`);
    }
};
