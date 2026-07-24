/**
 * Observable fail-closed guard for the legacy event-cancellation worker.
 *
 * The prior worker called Razorpay and then changed orders and tickets without
 * canonical refund-ledger finalization. Event cancellation must be rebuilt as
 * a Gateway-owned idempotent orchestration before this function is enabled.
 */

import { inngest, Events } from '../inngest-client.js';

export const handleEventCancellation = inngest.createFunction(
  {
    id: 'handle-event-cancellation',
    name: 'Blocked Legacy Event Cancellation',
    retries: 0,
  },
  { event: Events.EVENT_CANCELLED },
  async ({ event }) => {
    const error = new Error(
      `LEGACY_EVENT_CANCELLATION_DISABLED: event ${event.data?.eventId || 'unknown'} requires canonical refund orchestration`,
    );
    error.code = 'LEGACY_EVENT_CANCELLATION_DISABLED';
    throw error;
  },
);
