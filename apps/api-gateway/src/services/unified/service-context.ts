import type { Firestore } from 'firebase-admin/firestore';

// ─── ServiceLogger ────────────────────────────────────────────────────────────
//
// Structured logging interface for unified services.
// Accepts Fastify's Pino logger (fastify.log) or any compatible logger.
// Services should NEVER use console.warn/console.error directly —
// all log output must go through this interface for structured JSON logging.

export interface ServiceLogger {
  info(obj: Record<string, any>, msg?: string): void;
  warn(obj: Record<string, any>, msg?: string): void;
  error(obj: Record<string, any>, msg?: string): void;
}

/** Fallback logger that writes to console when no Fastify logger is available.
 *  Only used during testing or service bootstrap — in production, services
 *  always receive the Fastify Pino logger. */
export const consoleLogger: ServiceLogger = {
  info(obj, msg) {
    console.log(JSON.stringify({ level: 'info', msg, ...obj }));
  },
  warn(obj, msg) {
    console.warn(JSON.stringify({ level: 'warn', msg, ...obj }));
  },
  error(obj, msg) {
    console.error(JSON.stringify({ level: 'error', msg, ...obj }));
  },
};

// ─── ServiceContext ───────────────────────────────────────────────────────────
//
// All unified services receive this context instead of just `db: Firestore`.
// This gives them structured logging + optional Redis for caching without
// coupling them to Fastify types directly.

export interface ServiceContext {
  db: Firestore;
  log: ServiceLogger;
  redis?: {
    get(key: string): Promise<string | null>;
    set(key: string, value: string, mode: string, ttl: number): Promise<any>;
    del(key: string): Promise<any>;
    status: string;
  };
}

/** Build a ServiceContext from Fastify instance decorations.
 *  Called once per route registration, not per request. */
export function buildServiceContext(fastify: {
  db: Firestore;
  log: ServiceLogger;
  redis?: any;
}): ServiceContext {
  return {
    db: fastify.db,
    log: fastify.log,
    redis: fastify.redis,
  };
}
