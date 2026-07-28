import type { Firestore } from 'firebase-admin/firestore';
import type { PartnerContext, VenueSlot, SlotStatus } from './types.js';
import { toIso, safeStr } from './types.js';
import type { ServiceContext, ServiceLogger } from './service-context.js';
import { consoleLogger } from './service-context.js';

// ─── SchedulingService ────────────────────────────────────────────────────────
//
// THE single scheduling system. Replaces:
//   - venue_calendar (old)
//   - venues/{venueId}/slots (intermediate)
//   - slot_requests (old)
//
// Collection: availability_slots/{slotId}

const SLOTS_COLLECTION = 'availability_slots';

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

export interface CreateSlotInput {
  date: string;
  startTime: string;
  endTime: string;
  status?: SlotStatus;
  notes?: string;
}

export interface SlotRequestInput {
  venueId: string;
  date: string;
  startTime: string;
  endTime: string;
  notes?: string;
  eventId?: string;
  venueName?: string;
  hostName?: string;
  source?: string;
}

export class SchedulingService {
  private db: Firestore;
  private log: ServiceLogger;

  constructor(ctx: ServiceContext);
  /** @deprecated Use ServiceContext form. Retained for backward compatibility. */
  constructor(db: Firestore);
  constructor(arg: ServiceContext | Firestore) {
    if ('db' in arg && 'log' in arg) {
      this.db = arg.db;
      this.log = arg.log;
    } else {
      this.db = arg as Firestore;
      this.log = consoleLogger;
    }
  }

  // ── Calendar read ──────────────────────────────────────────────────────────

  async getCalendar(venueId: string, range: DateRange): Promise<VenueSlot[]> {
    const { startDate, endDate } = range;
    const startedAt = Date.now();

    // Filter and order the date range in Firestore so we only read slots inside
    // the requested window instead of scanning the venue's entire slot history.
    // Requires the composite index (venueId ASC, date ASC) in
    // firestore.indexes.json. A failed scheduling query must not be converted
    // into an empty calendar because that advertises unavailable time as open.
    let docs: FirebaseFirestore.QueryDocumentSnapshot[];
    try {
      const snap = await this.db
        .collection(SLOTS_COLLECTION)
        .where('venueId', '==', venueId)
        .where('date', '>=', startDate)
        .where('date', '<=', endDate)
        .orderBy('date', 'asc')
        .limit(200)
        .get();
      docs = snap.docs;
    } catch (err: any) {
      const message = err?.message ?? String(err);
      const missingIndex =
        String(err?.code) === '9' ||
        String(err?.code) === 'FAILED_PRECONDITION' ||
        message.includes('requires an index');
      if (!missingIndex) {
        this.log.error(
          { service: 'SchedulingService', method: 'getCalendar', venueId, error: message },
          'Firestore query failed',
        );
        throw schedulingUnavailable();
      }

      this.log.warn(
        { service: 'SchedulingService', method: 'getCalendar', venueId },
        'Composite calendar index unavailable; using bounded fail-closed fallback',
      );
      try {
        const fallback = await this.db
          .collection(SLOTS_COLLECTION)
          .where('venueId', '==', venueId)
          .limit(501)
          .get();
        if (fallback.docs.length > 500) {
          const unavailable = schedulingUnavailable();
          unavailable.code = 'SCHEDULING_WINDOW_LIMIT_EXCEEDED';
          throw unavailable;
        }
        docs = fallback.docs
          .filter((doc) => {
            const date = safeStr(doc.data()?.date || doc.data()?.requestedDate);
            return date >= startDate && date <= endDate;
          })
          .sort((left, right) => {
            const leftDate = safeStr(left.data()?.date || left.data()?.requestedDate);
            const rightDate = safeStr(right.data()?.date || right.data()?.requestedDate);
            return leftDate.localeCompare(rightDate);
          })
          .slice(0, 200);
      } catch (fallbackError: any) {
        if (fallbackError?.code === 'SCHEDULING_WINDOW_LIMIT_EXCEEDED') throw fallbackError;
        this.log.error(
          {
            service: 'SchedulingService',
            method: 'getCalendar',
            venueId,
            error: fallbackError?.message ?? String(fallbackError),
          },
          'Bounded calendar fallback failed',
        );
        throw schedulingUnavailable();
      }
    }

    const durationMs = Date.now() - startedAt;
    if (durationMs > 200) {
      this.log.warn(
        {
          service: 'SchedulingService',
          method: 'getCalendar',
          venueId,
          durationMs,
          resultCount: docs.length,
        },
        'Slow query detected',
      );
    }

    return docs.map((doc: any) => this.legacyDocToSlot(doc, venueId));
  }

  // ── Slot CRUD ─────────────────────────────────────────────────────────────

  async getSlot(venueId: string, slotId: string): Promise<VenueSlot | null> {
    const doc = await this.db
      .collection(SLOTS_COLLECTION)
      .doc(slotId)
      .get()
      .catch((err) => {
        this.log.error(
          {
            service: 'SchedulingService',
            method: 'getSlot',
            slotId,
            error: err?.message ?? String(err),
          },
          'Firestore read failed',
        );
        return null;
      });

    if (!doc?.exists) return null;
    const slot = this.legacyDocToSlot(doc as any, venueId);
    if (slot.venueId !== venueId) return null;
    return slot;
  }

  async createSlot(
    ctx: PartnerContext,
    venueId: string,
    input: CreateSlotInput,
  ): Promise<VenueSlot> {
    const now = new Date();
    let createdSlotId: string | null = null;

    await this.db.runTransaction(async (txn) => {
      const existingSnap = await txn.get(
        this.db
          .collection(SLOTS_COLLECTION)
          .where('venueId', '==', venueId)
          .where('date', '==', input.date)
          .limit(100),
      );

      for (const doc of existingSnap.docs) {
        const d = doc.data() as Record<string, any>;
        const status = normalizeLegacyStatus(safeStr(d.status || d.slotStatus || 'open'));
        if (!['open', 'requested', 'approved', 'occupied', 'blocked'].includes(status)) continue;

        const existingStart = d.requestedStartTime || d.startTime || null;
        const existingEnd = d.requestedEndTime || d.endTime || null;

        const isExistingFullDayBlock = status === 'blocked' && (!existingStart || !existingEnd);
        const isInputFullDayBlock =
          input.status === 'blocked' && (!input.startTime || !input.endTime);

        let conflict = false;
        if (isExistingFullDayBlock || isInputFullDayBlock) {
          conflict = true;
        } else if (existingStart && existingEnd && input.startTime && input.endTime) {
          conflict = schedulingRangesOverlap(
            input.startTime,
            input.endTime,
            existingStart,
            existingEnd,
          );
        }

        if (conflict) {
          const err: any = new Error('Time slot conflict: another slot already covers this range');
          err.statusCode = 409;
          err.code = 'SLOT_CONFLICT';
          throw err;
        }
      }

      const ref = this.db.collection(SLOTS_COLLECTION).doc();
      createdSlotId = ref.id;
      txn.set(ref, {
        venueId,
        date: input.date,
        startTime: input.startTime,
        endTime: input.endTime,
        status: input.status ?? 'open',
        requestedDate: input.date,
        requestedStartTime: input.startTime,
        requestedEndTime: input.endTime,
        requestedBy: null,
        approvedBy: null,
        eventId: null,
        notes: input.notes ?? null,
        isActive: true,
        source: input.status === 'blocked' ? 'venue_block' : 'venue_slot',
        createdAt: now,
        updatedAt: now,
      });
    });

    this.log.info(
      {
        service: 'SchedulingService',
        method: 'createSlot',
        venueId,
        slotId: createdSlotId,
        status: input.status ?? 'open',
      },
      'Slot created',
    );

    const doc = await this.db.collection(SLOTS_COLLECTION).doc(createdSlotId!).get();
    return this.legacyDocToSlot(doc as any, venueId);
  }

  async updateSlotStatus(
    ctx: PartnerContext,
    venueId: string,
    slotId: string,
    status: SlotStatus,
    notes?: string,
  ): Promise<VenueSlot | null> {
    const ref = this.db.collection(SLOTS_COLLECTION).doc(slotId);
    let updatedSlot: VenueSlot | null = null;

    await this.db.runTransaction(async (txn) => {
      const doc = await txn.get(ref);
      if (!doc.exists) return;
      if (safeStr(doc.data()?.venueId) !== venueId) return;

      const current = this.legacyDocToSlot(doc as any, venueId);
      if (current.status === status) {
        updatedSlot = current;
        return;
      }

      const updates: Record<string, any> = { status, updatedAt: new Date() };
      if (notes !== undefined) updates.notes = notes;

      if (status === 'approved') {
        const approvalDate = doc.data()?.requestedDate || doc.data()?.date || null;
        const approvalStart = doc.data()?.requestedStartTime || doc.data()?.startTime || null;
        const approvalEnd = doc.data()?.requestedEndTime || doc.data()?.endTime || null;
        if (!approvalDate || !approvalStart || !approvalEnd) {
          const err: any = new Error('Requested slot is missing a complete approval time range');
          err.statusCode = 409;
          err.code = 'INVALID_SLOT';
          throw err;
        }

        const sameDaySnap = await txn.get(
          this.db
            .collection(SLOTS_COLLECTION)
            .where('venueId', '==', venueId)
            .where('date', '==', approvalDate)
            .limit(100),
        );

        for (const slotDoc of sameDaySnap.docs) {
          if (slotDoc.id === slotId) continue;
          const candidate = slotDoc.data() as Record<string, any>;
          const candidateStatus = normalizeLegacyStatus(
            safeStr(candidate.status || candidate.slotStatus || 'open'),
          );
          if (!['approved', 'occupied', 'blocked'].includes(candidateStatus)) continue;

          const candidateStart = candidate.requestedStartTime || candidate.startTime || null;
          const candidateEnd = candidate.requestedEndTime || candidate.endTime || null;

          const isCandidateFullDayBlock =
            candidateStatus === 'blocked' && (!candidateStart || !candidateEnd);

          let conflict = false;
          if (isCandidateFullDayBlock) {
            conflict = true;
          } else if (candidateStart && candidateEnd && approvalStart && approvalEnd) {
            conflict = schedulingRangesOverlap(
              approvalStart,
              approvalEnd,
              candidateStart,
              candidateEnd,
            );
          }

          if (conflict) {
            const err: any = new Error(
              'Time slot conflict: another event is already scheduled at this time',
            );
            err.statusCode = 409;
            err.code = 'SLOT_CONFLICT';
            throw err;
          }
        }

        updates.approvedBy = ctx.partnerId;
        updates.respondedAt = new Date();
        updates.date = approvalDate;
        updates.startTime = approvalStart;
        updates.endTime = approvalEnd;
      }

      if (status === 'rejected') {
        updates.rejectedBy = ctx.partnerId;
        updates.respondedAt = new Date();
      }

      txn.update(ref, updates);
      updatedSlot = this.legacyDocToSlot(
        {
          id: doc.id,
          data: () => ({ ...(doc.data() || {}), ...updates }),
        } as any,
        venueId,
      );
    });

    this.log.info(
      {
        service: 'SchedulingService',
        method: 'updateSlotStatus',
        venueId,
        slotId,
        newStatus: status,
      },
      'Slot status updated',
    );

    return updatedSlot;
  }

  // ── Slot requests (host → venue) ──────────────────────────────────────────

  async getPendingRequests(venueId: string): Promise<VenueSlot[]> {
    const startedAt = Date.now();

    let snap: FirebaseFirestore.QuerySnapshot;
    try {
      snap = await this.db
        .collection(SLOTS_COLLECTION)
        .where('venueId', '==', venueId)
        .where('status', 'in', ['pending', 'requested'])
        .orderBy('date', 'asc')
        .limit(100)
        .get();
    } catch (err: any) {
      this.log.error(
        {
          service: 'SchedulingService',
          method: 'getPendingRequests',
          venueId,
          error: err?.message ?? String(err),
        },
        'Firestore query failed',
      );
      const unavailable: any = new Error('Venue slot requests are temporarily unavailable');
      unavailable.statusCode = 503;
      unavailable.code = 'SCHEDULING_DATA_UNAVAILABLE';
      throw unavailable;
    }

    const durationMs = Date.now() - startedAt;
    if (durationMs > 200) {
      this.log.warn(
        { service: 'SchedulingService', method: 'getPendingRequests', venueId, durationMs },
        'Slow query detected',
      );
    }

    return (snap as any).docs
      .map((doc: any) => this.legacyDocToSlot(doc, venueId))
      .filter((slot: VenueSlot) => slot.status === 'requested');
  }

  async requestSlot(ctx: PartnerContext, input: SlotRequestInput): Promise<VenueSlot> {
    const slotsCollection = this.db.collection(SLOTS_COLLECTION);
    const slotRef = input.eventId ? slotsCollection.doc(input.eventId) : slotsCollection.doc();
    const newSlotId = slotRef.id;

    // P0-4: Wrap conflict check + write in a Firestore transaction to prevent
    // TOCTOU race condition that allows double-bookings.
    await this.db.runTransaction(async (txn) => {
      await this.requestSlotInTransaction(txn as any, ctx, input, slotRef as any);
    });

    this.log.info(
      {
        service: 'SchedulingService',
        method: 'requestSlot',
        venueId: input.venueId,
        slotId: newSlotId,
        hostId: ctx.partnerId,
      },
      'Slot request created via transaction',
    );

    const doc = await this.db.collection(SLOTS_COLLECTION).doc(newSlotId!).get();
    return this.legacyDocToSlot(doc as any, input.venueId);
  }

  async requestSlotInTransaction(
    txn: FirebaseFirestore.Transaction,
    ctx: PartnerContext,
    input: SlotRequestInput,
    providedRef?: FirebaseFirestore.DocumentReference,
  ): Promise<string> {
    const now = new Date();
    const slotsCollection = this.db.collection(SLOTS_COLLECTION);
    const ref =
      providedRef ?? (input.eventId ? slotsCollection.doc(input.eventId) : slotsCollection.doc());
    const existingDoc = await txn.get(ref);
    const conflictSnap = await txn.get(
      this.db
        .collection(SLOTS_COLLECTION)
        .where('venueId', '==', input.venueId)
        .where('date', '==', input.date)
        .limit(100),
    );

    if (existingDoc.exists) {
      const existing = existingDoc.data() as Record<string, any>;
      const existingEventId = safeStr(existing.eventId);
      if (!input.eventId || existingEventId !== input.eventId) {
        const err: any = new Error('Slot idempotency conflict');
        err.statusCode = 409;
        err.code = 'SLOT_IDEMPOTENCY_CONFLICT';
        throw err;
      }
      const existingStatus = normalizeLegacyStatus(
        safeStr(existing.status || existing.slotStatus || 'open'),
      );
      if (['approved', 'occupied'].includes(existingStatus)) {
        const err: any = new Error('The event slot is already approved');
        err.statusCode = 409;
        err.code = 'SLOT_ALREADY_APPROVED';
        throw err;
      }
    }

    for (const doc of conflictSnap.docs) {
      if (doc.id === ref.id) continue;
      const d = doc.data() as Record<string, any>;
      const status = normalizeLegacyStatus(safeStr(d.status || d.slotStatus || 'open'));
      if (!['requested', 'approved', 'occupied', 'blocked'].includes(status)) continue;

      const existingStart = d.requestedStartTime || d.startTime || null;
      const existingEnd = d.requestedEndTime || d.endTime || null;
      const isExistingFullDayBlock = status === 'blocked' && (!existingStart || !existingEnd);
      const conflict =
        isExistingFullDayBlock ||
        (existingStart &&
          existingEnd &&
          input.startTime &&
          input.endTime &&
          schedulingRangesOverlap(input.startTime, input.endTime, existingStart, existingEnd));

      if (conflict) {
        this.log.warn(
          {
            service: 'SchedulingService',
            method: 'requestSlot',
            venueId: input.venueId,
            date: input.date,
            conflictSlotId: doc.id,
          },
          'Slot conflict detected — rejecting request',
        );
        const err: any = new Error(
          'Time slot conflict: another event is already scheduled at this time',
        );
        err.statusCode = 409;
        err.code = 'SLOT_CONFLICT';
        throw err;
      }
    }

    const existingData = existingDoc.exists ? (existingDoc.data() as Record<string, any>) : {};
    const record = {
      venueId: input.venueId,
      venueName: input.venueName ?? existingData.venueName ?? null,
      date: input.date,
      startTime: input.startTime,
      endTime: input.endTime,
      requestedDate: input.date,
      requestedStartTime: input.startTime,
      requestedEndTime: input.endTime,
      status: 'pending',
      requestedBy: ctx.partnerId,
      hostId: ctx.partnerId,
      hostName: input.hostName ?? existingData.hostName ?? null,
      approvedBy: null,
      eventId: input.eventId ?? null,
      notes: input.notes ?? null,
      isActive: true,
      source: input.source ?? (input.eventId ? 'host_event_request' : 'partner_request'),
      createdAt: existingData.createdAt ?? now,
      updatedAt: now,
    };

    if (existingDoc.exists) {
      txn.set(ref, record, { merge: true });
    } else {
      txn.create(ref, record);
    }
    return ref.id;
  }

  async approveRequest(
    ctx: PartnerContext,
    venueId: string,
    slotId: string,
    notes?: string,
  ): Promise<VenueSlot | null> {
    return this.updateSlotStatus(ctx, venueId, slotId, 'approved', notes);
  }

  async rejectRequest(
    ctx: PartnerContext,
    venueId: string,
    slotId: string,
    notes?: string,
  ): Promise<VenueSlot | null> {
    return this.updateSlotStatus(ctx, venueId, slotId, 'rejected', notes);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private docToSlot(
    doc: FirebaseFirestore.DocumentSnapshot | FirebaseFirestore.QueryDocumentSnapshot,
    venueId: string,
  ): VenueSlot {
    const d = (doc.data() ?? {}) as Record<string, any>;
    return {
      slotId: doc.id,
      venueId: safeStr(d.venueId || venueId),
      date: safeStr(d.date),
      startTime: safeStr(d.startTime),
      endTime: safeStr(d.endTime),
      status: (d.status ?? 'open') as SlotStatus,
      requestedBy: d.requestedBy ?? null,
      approvedBy: d.approvedBy ?? null,
      eventId: d.eventId ?? null,
      notes: d.notes ?? null,
      createdAt: toIso(d.createdAt),
      updatedAt: toIso(d.updatedAt),
    };
  }

  private legacyDocToSlot(
    doc: FirebaseFirestore.QueryDocumentSnapshot,
    venueId: string,
  ): VenueSlot {
    const d = doc.data() as Record<string, any>;
    // Normalize legacy field names
    const rawStatus = safeStr(d.status || d.slotStatus || 'open');
    const status = normalizeLegacyStatus(rawStatus);

    return {
      slotId: doc.id,
      venueId: safeStr(d.venueId || venueId),
      date: safeStr(d.date || toIso(d.startDate)?.split('T')[0]),
      startTime: safeStr(d.startTime || toIso(d.startDate)?.split('T')[1]?.slice(0, 5)),
      endTime: safeStr(d.endTime || toIso(d.endDate)?.split('T')[1]?.slice(0, 5)),
      status,
      requestedBy: d.requestedBy ?? d.hostId ?? null,
      approvedBy: d.approvedBy ?? null,
      eventId: d.eventId ?? null,
      notes: d.notes ?? d.description ?? null,
      createdAt: toIso(d.createdAt),
      updatedAt: toIso(d.updatedAt),
    };
  }
}

// ─── Utils ────────────────────────────────────────────────────────────────────

function schedulingUnavailable() {
  const unavailable: any = new Error('Venue scheduling data is temporarily unavailable');
  unavailable.statusCode = 503;
  unavailable.code = 'SCHEDULING_DATA_UNAVAILABLE';
  return unavailable;
}

function toNightlifeMinutes(value: string): number {
  const [hour, minute] = value.split(':').map(Number);
  const minutes = hour * 60 + minute;
  return hour < 12 ? minutes + 24 * 60 : minutes;
}

export function schedulingRangesOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  const normalizedStartA = toNightlifeMinutes(startA);
  let normalizedEndA = toNightlifeMinutes(endA);
  const normalizedStartB = toNightlifeMinutes(startB);
  let normalizedEndB = toNightlifeMinutes(endB);
  if (normalizedEndA <= normalizedStartA) normalizedEndA += 24 * 60;
  if (normalizedEndB <= normalizedStartB) normalizedEndB += 24 * 60;
  return normalizedStartA < normalizedEndB && normalizedStartB < normalizedEndA;
}

function normalizeLegacyStatus(raw: string): SlotStatus {
  const s = raw.toLowerCase();
  if (s === 'open' || s === 'available') return 'open';
  if (s === 'requested' || s === 'pending') return 'requested';
  if (s === 'approved' || s === 'confirmed') return 'approved';
  if (s === 'occupied' || s === 'booked' || s === 'active') return 'occupied';
  if (s === 'blocked' || s === 'closed') return 'blocked';
  if (s === 'rejected' || s === 'declined') return 'rejected';
  return 'open';
}
