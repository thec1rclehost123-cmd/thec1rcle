import { randomUUID } from 'node:crypto';
import { getAdminDb } from './admin.js';

/**
 * THE C1RCLE - Unified Slot Engine
 * Centralizes venue availability, blocking, and booking logic.
 *
 * Data Model:
 * Each slot is an atomic window of time (or full day) on a specific date.
 */

const SLOTS_COLLECTION = 'availability_slots';

export function getSlotRef(venueId) {
  return getAdminDb().collection('venues').doc(venueId).collection(SLOTS_COLLECTION);
}

/**
 * Gets the slot calendar for a venue within a date range.
 */
export async function getSlotCalendar(venueId, startDate, endDate) {
  const db = getAdminDb();
  const snap = await getSlotRef(venueId)
    .where('date', '>=', startDate)
    .where('date', '<=', endDate)
    .orderBy('date')
    .orderBy('startTime')
    .get();

  const rawSlots = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // Group by date
  const byDate = new Map();
  for (const s of rawSlots) {
    const list = byDate.get(s.date) ?? [];
    list.push(s);
    byDate.set(s.date, list);
  }

  const days = [];
  const cur = new Date(startDate);
  const end = new Date(endDate);
  while (cur <= end) {
    const dateStr = cur.toISOString().slice(0, 10);
    const slots = byDate.get(dateStr) ?? [];

    const fullyBlocked = slots.some(
      (s) => (s.status === 'blocked' || s.status === 'booked') && s.startTime === null,
    );
    const partiallyBlocked =
      !fullyBlocked &&
      slots.some((s) => (s.status === 'blocked' || s.status === 'booked') && s.startTime !== null);

    days.push({
      date: dateStr,
      slots,
      fullyBlocked,
      partiallyBlocked,
      openCount: slots.filter((s) => s.status === 'open').length,
      pendingCount: slots.filter((s) => s.status === 'pending_review').length,
      confirmedCount: slots.filter((s) => s.status === 'booked').length,
    });

    cur.setDate(cur.getDate() + 1);
  }

  return { venueId, startDate, endDate, days };
}

/**
 * Detects conflicts for a given time window.
 */
export async function detectConflicts(venueId, date, startTime, endTime, statusFilter) {
  const snap = await getSlotRef(venueId).where('date', '==', date).get();
  const slots = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return slots.filter((s) => {
    if (!statusFilter.includes(s.status)) return false;
    if (s.startTime === null || startTime === null) return true;
    return s.startTime < (endTime ?? '23:59') && (s.endTime ?? '23:59') > startTime;
  });
}

/**
 * Creates a blocked slot.
 */
export async function createBlockedSlot(venueId, date, startTime, endTime, actorId, note = '') {
  const conflicts = await detectConflicts(venueId, date, startTime, endTime, ['booked', 'hold']);
  if (conflicts.length > 0) throw new Error('Conflict with existing bookings');

  const id = randomUUID();
  const now = new Date().toISOString();
  const slot = {
    id,
    venueId,
    date,
    startTime: startTime ?? null,
    endTime: endTime ?? null,
    status: 'blocked',
    source: startTime && endTime ? 'partial_block' : 'manual_block',
    linkedEventId: null,
    note,
    createdBy: actorId,
    updatedBy: actorId,
    createdAt: now,
    updatedAt: now,
  };

  await getSlotRef(venueId).doc(id).set(slot);
  return slot;
}

/**
 * Consumes a slot for an event (approved host request).
 */
export async function consumeSlotForEvent(venueId, eventId, date, startTime, endTime, actorId) {
  const id = randomUUID();
  const now = new Date().toISOString();
  const slot = {
    id,
    venueId,
    date,
    startTime: startTime ?? null,
    endTime: endTime ?? null,
    status: 'booked',
    source: 'event_confirmed',
    linkedEventId: eventId,
    note: '',
    createdBy: actorId,
    updatedBy: actorId,
    createdAt: now,
    updatedAt: now,
  };

  const db = getAdminDb();
  const batch = db.batch();
  batch.set(getSlotRef(venueId).doc(id), slot);

  const overlapping = await detectConflicts(venueId, date, startTime, endTime, ['open']);
  for (const s of overlapping) {
    batch.delete(getSlotRef(venueId).doc(s.id));
  }

  await batch.commit();
  return slot;
}

export default {
  getSlotRef,
  getSlotCalendar,
  detectConflicts,
  createBlockedSlot,
  consumeSlotForEvent,
};
