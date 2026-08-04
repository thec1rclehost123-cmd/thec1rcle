import { Order } from '../repositories/order-repository.js';
// @ts-ignore
import { consumeAdmission } from '@c1rcle/core/surge';
// @ts-ignore
import { sendEvent, Events } from '@c1rcle/core/inngest-client';
// @ts-ignore
import { getAdminDb } from '@c1rcle/core/admin';
// @ts-ignore
import { telemetry } from '@c1rcle/core/telemetry';
// @ts-ignore
import { finalizeFreeTicketOrder } from '@c1rcle/core/workflows/ticketing';

export class FulfillmentService {
  constructor() {}

  async processFulfillment(order: Order, queueId?: string | null): Promise<void> {
    const isFreeTicketOrder =
      !order.isRSVP && Number((order as any).totalPaise ?? order.totalAmount ?? 0) === 0;

    // Free orders have no provider callback to invoke paid finalization. Commit
    // their inventory and wallet artifacts before any best-effort side effects.
    if (isFreeTicketOrder) {
      const db = await getAdminDb();
      await finalizeFreeTicketOrder({
        db,
        orderId: order.id,
        userId: order.userId,
      });
    }

    // 1. Consume admission if part of a surge queue
    if (queueId) {
      try {
        const db = await getAdminDb();
        await consumeAdmission(db, queueId);
        telemetry.track('QUEUE_ADMISSION_CONSUMED', { queueId, orderId: order.id });
      } catch (e: any) {
        telemetry.error('[Fulfillment] Failed to consume queue admission', e, {
          queueId,
          orderId: order.id,
        });
      }
    }

    // 2. RSVP fulfillment still uses the legacy event trigger. Ticket orders
    // use the transactional outbox created by their authoritative finalizer.
    // Stats (ticketsSold, totalRevenue) are updated by the background Inngest handler
    // using sharded counters — direct FieldValue.increment on the event doc would hit
    // Firestore's ~1 write/s/doc limit during high-volume drops.
    const ticketsCount =
      (order.tickets || []).reduce((s: number, t: any) => s + (t.quantity || 1), 0) || 1;

    if (isFreeTicketOrder) return;

    try {
      await sendEvent(Events.TICKET_PURCHASED, {
        orderId: order.id,
        userId: order.userId,
        userEmail: order.userEmail,
        eventId: order.eventId,
        tickets: order.tickets,
        totalAmount: order.totalAmount,
        ticketsCount,
        promoterCode: order.promoterCode,
      });
      telemetry.track('FULFILLMENT_TRIGGERED', { orderId: order.id, userId: order.userId });
    } catch (e: any) {
      telemetry.error('[Fulfillment] Inngest trigger failed', e, { orderId: order.id });
    }
  }
}
