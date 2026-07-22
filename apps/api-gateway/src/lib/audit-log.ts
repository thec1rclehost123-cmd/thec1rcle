import { randomUUID } from 'crypto';
import type { FastifyInstance } from 'fastify';

export interface AuditLogInput {
  action: string;
  actorUid?: string | null;
  actorRole?: string | null;
  partnerId?: string | null;
  partnerType?: string | null;
  entityId?: string | null;
  entityType?: string | null;
  requestId?: string | null;
  payload?: Record<string, unknown>;
}

function removeUndefined(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => (item === undefined ? null : removeUndefined(item)));
  }

  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, removeUndefined(item)]),
    );
  }

  return value;
}

export async function writeAuditLog(fastify: FastifyInstance, input: AuditLogInput) {
  const entryId = randomUUID();
  await fastify.db
    .collection('audit_logs')
    .doc(entryId)
    .set({
      id: entryId,
      action: input.action,
      actorUid: input.actorUid || null,
      actorRole: input.actorRole || null,
      partnerId: input.partnerId || null,
      partnerType: input.partnerType || null,
      entityId: input.entityId || null,
      entityType: input.entityType || null,
      requestId: input.requestId || null,
      payload: removeUndefined(input.payload || {}),
      createdAt: new Date().toISOString(),
    });
}
