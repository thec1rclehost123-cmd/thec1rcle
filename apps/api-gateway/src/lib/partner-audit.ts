import type { FastifyInstance } from 'fastify';
import type { AuditLogInput } from './audit-log.js';

export function logPartnerAudit(fastify: FastifyInstance, input: AuditLogInput) {
  return fastify.writeAuditLog(input).catch(() => {});
}
