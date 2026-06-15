import { inngest } from '../inngest-client.js';
import { getAdminDb } from '../admin.js';
import { FieldValue } from 'firebase-admin/firestore';

/**
 * Guest Operations Workflows
 *
 * Triggered by order/ticket lifecycle events to keep the guest_records
 * collection in sync and lock ops when events end.
 */

// ── onOrderPaid → create guest record ────────────────────────────────────────

export const onOrderPaid_createGuestRecord = inngest.createFunction(
  { id: 'guest-ops/on-order-paid-create-guest-record', retries: 3 },
  { event: 'ticket/purchased' },
  async ({ event, step }) => {
    const { orderId, eventId, venueId, userId, tickets } = event.data;
    if (!orderId || !eventId || !venueId) return { skipped: true, reason: 'missing fields' };

    const db = getAdminDb();

    // Fetch order to get display name and phone
    const orderSnap = await step.run('fetch-order', async () => {
      const snap = await db.collection('orders').doc(orderId).get();
      return snap.exists ? snap.data() : null;
    });
    if (!orderSnap) return { skipped: true, reason: 'order not found' };

    const displayName =
      orderSnap.displayName ??
      `${orderSnap.firstName ?? ''} ${orderSnap.lastName ?? ''}`.trim() ??
      'Unknown';
    const phone = orderSnap.phone ?? orderSnap.buyerPhone ?? null;

    // One guest record per ticket (quantity-aware)
    const ticketList = Array.isArray(tickets) ? tickets : [];
    const results = await step.run('create-guest-records', async () => {
      const batch = db.batch();
      const guestIds = [];

      for (const ticket of ticketList) {
        const qty = ticket.quantity ?? 1;
        for (let i = 0; i < qty; i++) {
          const guestRef = db.collection('guest_records').doc(eventId).collection('guests').doc();
          const guestId = guestRef.id;
          guestIds.push(guestId);

          batch.set(guestRef, {
            guestId,
            eventId,
            venueId,
            displayName: qty > 1 ? `${displayName} (${i + 1})` : displayName,
            maskedPhone: phone ? phone.replace(/(\+?\d{2})(\d+)(\d{4})/, '$1****$3') : null,
            fullPhone: phone,
            guestType: 'ticketed',
            source: 'ticket_purchase',
            status: 'expected',
            ticketId: ticket.ticketId ?? ticket.entitlementId ?? null,
            orderId,
            ticketTierId: ticket.tierId ?? null,
            ticketTierName: ticket.tierName ?? ticket.name ?? null,
            checkedIn: false,
            addedByUid: userId ?? 'system',
            addedByName: 'System (ticket purchase)',
            addedAt: new Date().toISOString(),
            isRemoved: false,
            isLocked: false,
          });
        }
      }

      // Bump expected count on event summary
      const summaryRef = db.collection('event_guest_summary').doc(eventId);
      batch.set(
        summaryRef,
        {
          totalExpected: FieldValue.increment(
            ticketList.reduce((a, t) => a + (t.quantity ?? 1), 0),
          ),
          ticketedGuests: FieldValue.increment(
            ticketList.reduce((a, t) => a + (t.quantity ?? 1), 0),
          ),
          lastUpdatedAt: new Date().toISOString(),
        },
        { merge: true },
      );

      await batch.commit();
      return { created: guestIds.length };
    });

    return { orderId, eventId, ...results };
  },
);

// ── onOrderRefunded → soft-remove guest records ───────────────────────────────

export const onOrderRefunded_removeGuestRecord = inngest.createFunction(
  { id: 'guest-ops/on-order-refunded-remove-guest-record', retries: 3 },
  { event: 'ticket/refunded' },
  async ({ event, step }) => {
    const { orderId, eventId, venueId } = event.data;
    if (!orderId || !eventId) return { skipped: true };

    const db = getAdminDb();

    const removed = await step.run('soft-remove-guests', async () => {
      const snap = await db
        .collection('guest_records')
        .doc(eventId)
        .collection('guests')
        .where('orderId', '==', orderId)
        .where('isRemoved', '==', false)
        .get();

      if (snap.empty) return 0;

      const batch = db.batch();
      snap.docs.forEach((doc) => {
        batch.update(doc.ref, {
          isRemoved: true,
          status: 'removed',
          updatedAt: new Date().toISOString(),
        });
      });

      // Decrement expected count
      const summaryRef = db.collection('event_guest_summary').doc(eventId);
      batch.set(
        summaryRef,
        {
          totalExpected: FieldValue.increment(-snap.size),
          ticketedGuests: FieldValue.increment(-snap.size),
          lastUpdatedAt: new Date().toISOString(),
        },
        { merge: true },
      );

      await batch.commit();
      return snap.size;
    });

    return { orderId, eventId, removed };
  },
);

// ── onTableConfirmed → create guest records for table booking ─────────────────

export const onTableConfirmed_createGuestRecords = inngest.createFunction(
  { id: 'guest-ops/on-table-confirmed-create-guest-records', retries: 3 },
  { event: 'table/confirmed' },
  async ({ event, step }) => {
    const {
      bookingId,
      eventId,
      venueId,
      tableId,
      tableName,
      hostId,
      hostName,
      guestNames,
      addedByUid,
      addedByName,
    } = event.data;
    if (!bookingId || !eventId || !venueId) return { skipped: true };

    const db = getAdminDb();
    const names = Array.isArray(guestNames) ? guestNames : [];

    const results = await step.run('create-table-guest-records', async () => {
      const batch = db.batch();
      const guestIds = [];

      for (const name of names) {
        const guestRef = db.collection('guest_records').doc(eventId).collection('guests').doc();
        guestIds.push(guestRef.id);

        batch.set(guestRef, {
          guestId: guestRef.id,
          eventId,
          venueId,
          displayName: name,
          guestType: 'table',
          source: 'table_booking',
          status: 'expected',
          tableId: tableId ?? null,
          tableName: tableName ?? null,
          hostId: hostId ?? null,
          hostName: hostName ?? null,
          checkedIn: false,
          addedByUid: addedByUid ?? 'system',
          addedByName: addedByName ?? 'System (table booking)',
          addedAt: new Date().toISOString(),
          isRemoved: false,
          isLocked: false,
        });
      }

      const summaryRef = db.collection('event_guest_summary').doc(eventId);
      batch.set(
        summaryRef,
        {
          totalExpected: FieldValue.increment(names.length),
          tableGuests: FieldValue.increment(names.length),
          lastUpdatedAt: new Date().toISOString(),
        },
        { merge: true },
      );

      await batch.commit();
      return { created: guestIds.length };
    });

    return { bookingId, eventId, ...results };
  },
);

// ── onEventCompleted → lock guest ops ────────────────────────────────────────

export const onEventCompleted_lockGuestOps = inngest.createFunction(
  { id: 'guest-ops/on-event-completed-lock', retries: 2 },
  { event: 'event/ended' },
  async ({ event, step }) => {
    const { eventId, venueId } = event.data;
    if (!eventId) return { skipped: true };

    const db = getAdminDb();

    await step.run('lock-guest-ops', async () => {
      const rulesRef = db.collection('event_guest_rules').doc(eventId);
      await rulesRef.set(
        {
          isLocked: true,
          lockedAt: new Date().toISOString(),
          lockedBy: 'system (event ended)',
        },
        { merge: true },
      );
    });

    await step.run('mark-no-shows', async () => {
      // Batch update expected → no_show for all who never checked in
      const snap = await db
        .collection('guest_records')
        .doc(eventId)
        .collection('guests')
        .where('status', '==', 'expected')
        .where('isRemoved', '==', false)
        .get();

      if (snap.empty) return;

      const chunks = [];
      for (let i = 0; i < snap.docs.length; i += 400) {
        chunks.push(snap.docs.slice(i, i + 400));
      }
      for (const chunk of chunks) {
        const batch = db.batch();
        chunk.forEach((doc) => {
          batch.update(doc.ref, { status: 'no_show', updatedAt: new Date().toISOString() });
        });
        await batch.commit();
      }
    });

    return { eventId, locked: true };
  },
);

// ── onDeviceHeartbeatMissed → notify manager ─────────────────────────────────

export const onDeviceHeartbeatMissed_notifyManager = inngest.createFunction(
  {
    id: 'guest-ops/on-device-heartbeat-missed',
    retries: 1,
    throttle: { limit: 1, period: '5m', key: 'event.data.deviceId' },
  },
  { event: 'scanner/heartbeat-missed' },
  async ({ event, step }) => {
    const { eventId, venueId, deviceId, deviceName, operatorName, lastHeartbeat } = event.data;
    if (!eventId || !deviceId) return { skipped: true };

    const db = getAdminDb();

    // Find venue managers/owners to notify
    const managers = await step.run('find-managers', async () => {
      const snap = await db
        .collection('venue_members')
        .where('venueId', '==', venueId)
        .where('role', 'in', ['OWNER', 'MANAGER'])
        .get();
      return snap.docs.map((d) => ({ uid: d.data().userId, email: d.data().email }));
    });

    // Write in-app notification for each manager
    await step.run('write-notifications', async () => {
      const batch = db.batch();
      const now = new Date().toISOString();
      for (const mgr of managers) {
        const notifRef = db.collection('partner_notifications').doc();
        batch.set(notifRef, {
          recipientUid: mgr.uid,
          venueId,
          eventId,
          type: 'scanner_offline',
          title: 'Scanner Offline',
          body: `${deviceName ?? deviceId} (${operatorName ?? 'unknown'}) has gone offline.`,
          deviceId,
          lastHeartbeat,
          createdAt: now,
          read: false,
        });
      }
      await batch.commit();
    });

    return { eventId, deviceId, notified: managers.length };
  },
);

// ── copyVenueDefaultsToEventRules ────────────────────────────────────────────

export const copyVenueDefaultsToEventRules = inngest.createFunction(
  { id: 'guest-ops/copy-venue-defaults-to-event-rules', retries: 2 },
  { event: 'event/published' },
  async ({ event, step }) => {
    const { eventId, venueId } = event.data;
    if (!eventId || !venueId) return { skipped: true };

    const db = getAdminDb();

    await step.run('copy-defaults', async () => {
      // Check if rules already exist for this event
      const existingRules = await db.collection('event_guest_rules').doc(eventId).get();
      if (existingRules.exists) return { alreadyExists: true };

      // Fetch venue-level defaults
      const venueDefaults = await db.collection('venue_guest_rule_defaults').doc(venueId).get();

      const defaults = venueDefaults.exists ? venueDefaults.data() : {};

      await db
        .collection('event_guest_rules')
        .doc(eventId)
        .set({
          eventId,
          venueId,
          entryCutoffEnabled: false,
          reEntryEnabled: defaults?.reEntryEnabled ?? false,
          reEntryWindowMins: defaults?.reEntryWindowMins ?? 60,
          compApprovalRequired: defaults?.compApprovalRequired ?? false,
          vipApprovalRequired: defaults?.vipApprovalRequired ?? false,
          manualAddCap: defaults?.manualAddCap ?? 50,
          staffAddCap: defaults?.staffAddCap ?? 10,
          manualCheckInEnabled: true,
          manualOverrideRequiresReason: defaults?.manualOverrideRequiresReason ?? false,
          exportEnabled: defaults?.exportEnabled ?? true,
          exportFormat: defaults?.exportFormat ?? 'csv',
          exportPiiLevel: defaults?.exportPiiLevel ?? 'masked',
          isLocked: false,
          updatedAt: new Date().toISOString(),
          updatedBy: 'system',
        });
    });

    return { eventId, venueId };
  },
);
