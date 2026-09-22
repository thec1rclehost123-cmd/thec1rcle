import crypto from 'crypto';
import * as Sentry from '@sentry/node';
import type { IncomingMessage } from 'http';
import { FastifyReply, FastifyRequest } from 'fastify';

/**
 * ─── Request correlation tracing ──────────────────────────────────────────────
 * Single home of `x-request-id` generation and echo. Extracted from `app.ts`
 * so the V2 contract can test it directly; `app.ts` calls into these.
 */

/** Accept a client-supplied `x-request-id` (echos it), else mint a UUID. */
export function genReqId(req: IncomingMessage): string {
  const header = req.headers['x-request-id'];
  if (typeof header === 'string' && header.length > 0) return header;
  return crypto.randomUUID();
}

/** Tag Sentry and echo the request id on the response. */
export async function onRequestHook(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  Sentry.setTag('request_id', request.id);
  reply.header('x-request-id', request.id);
}
