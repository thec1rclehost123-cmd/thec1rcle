import type { FastifyInstance } from 'fastify';

export async function publishTicketPurchaseSync(
  fastify: FastifyInstance,
  result: any,
): Promise<void> {
  const order = result?.order || result;
  if (!order?.eventId) return;

  const eventId = order.eventId;
  const partnerIds = [order.hostId, order.venueId, order.promoterId].filter(Boolean);

  const invalidations: Promise<unknown>[] = [];
  if (fastify.cache) {
    if (typeof fastify.cache.delete === 'function') {
      invalidations.push(
        fastify.cache.delete('events:detail', eventId),
        fastify.cache.delete('analytics:event', `event:${eventId}:computed`),
      );
    }
    if (typeof fastify.cache.invalidateNamespace === 'function') {
      invalidations.push(
        fastify.cache.invalidateNamespace('events:list'),
        fastify.cache.invalidateNamespace('events:nearby'),
      );
    }
  }
  const publicDiscoveryInvalidation = fastify.invalidatePublicDiscovery?.('events');
  if (publicDiscoveryInvalidation) invalidations.push(publicDiscoveryInvalidation);
  if (typeof fastify.redis?.del === 'function') {
    invalidations.push(
      ...partnerIds.map((partnerId) => fastify.redis.del(`finance:balance:${partnerId}`)),
    );
  }
  await Promise.allSettled(invalidations);

  const update = {
    type: 'ticket.purchase.confirmed',
    payload: {
      eventId,
      orderId: result.orderId || order.id,
      ticketIds: result.ticketIds || [],
      ledgerMarkerId: result.ledgerMarkerId || null,
      committedAt: order.confirmedAt || new Date().toISOString(),
    },
  };
  fastify.broadcast?.(update, `event:${eventId}`);
  for (const partnerId of partnerIds) {
    fastify.broadcast?.(update, `partner:${partnerId}`);
  }
}
