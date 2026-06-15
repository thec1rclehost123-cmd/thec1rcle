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
      payload: input.payload || {},
      createdAt: new Date().toISOString(),
    });
}
