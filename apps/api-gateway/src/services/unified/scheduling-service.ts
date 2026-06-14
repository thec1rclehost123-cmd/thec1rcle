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
  endDate: string;   // YYYY-MM-DD
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

    const snap = await this.db
      .collection(SLOTS_COLLECTION)
      .where('venueId', '==', venueId)
      .where('date', '>=', startDate)
      .where('date', '<=', endDate)
      .orderBy('date', 'asc')
      .limit(200)
      .get()
      .catch((err) => {
        this.log.error(
          { service: 'SchedulingService', method: 'getCalendar', venueId, error: err?.message ?? String(err) },
          'Firestore query failed'
        );
        return { docs: [] as any[] };
      });

    const durationMs = Date.now() - startedAt;
    if (durationMs > 200) {
      this.log.warn(
        { service: 'SchedulingService', method: 'getCalendar', venueId, durationMs, resultCount: (snap as any).docs.length },
        'Slow query detected'
      );
    }

    return (snap as any).docs.map((doc: any) => this.legacyDocToSlot(doc, venueId));
  }

  // ── Slot CRUD ─────────────────────────────────────────────────────────────

  async getSlot(venueId: string, slotId: string): Promise<VenueSlot | null> {
    const doc = await this.db
      .collection(SLOTS_COLLECTION)
      .doc(slotId)
      .get()
      .catch((err) => {
        this.log.error(
          { service: 'SchedulingService', method: 'getSlot', slotId, error: err?.message ?? String(err) },
          'Firestore read failed'
        );
        return null;
      });

    if (!doc?.exists) return null;
    const slot = this.legacyDocToSlot(doc as any, venueId);
    if (slot.venueId !== venueId) return null;
    return slot;
  }

  async createSlot(ctx: PartnerContext, venueId: string, input: CreateSlotInput): Promise<VenueSlot> {
    const now = new Date();
    let createdSlotId: string | null = null;

    await this.db.runTransaction(async (txn) => {
      const existingSnap = await txn.get(
        this.db.collection(SLOTS_COLLECTION)
          .where('venueId', '==', venueId)
          .where('date', '==', input.date)
          .limit(100)
      );

      for (const doc of existingSnap.docs) {
        const d = doc.data() as Record<string, any>;
        const status = normalizeLegacyStatus(safeStr(d.status || d.slotStatus || 'open'));
        if (!['open', 'requested', 'approved', 'occupied', 'blocked'].includes(status)) continue;

        const existingStart = safeStr(d.requestedStartTime || d.startTime);
        const existingEnd = safeStr(d.requestedEndTime || d.endTime);
        if (!existingStart || !existingEnd) continue;
        if (!timesOverlap(input.startTime, input.endTime, existingStart, existingEnd)) continue;

        const err: any = new Error('Time slot conflict: another slot already covers this range');
        err.statusCode = 409;
        err.code = 'SLOT_CONFLICT';
        throw err;
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
      { service: 'SchedulingService', method: 'createSlot', venueId, slotId: createdSlotId, status: input.status ?? 'open' },
      'Slot created'
    );

    const doc = await this.db.collection(SLOTS_COLLECTION).doc(createdSlotId!).get();
    return this.legacyDocToSlot(doc as any, venueId);
  }

  async updateSlotStatus(
    ctx: PartnerContext,
    venueId: string,
    slotId: string,
    status: SlotStatus,
    notes?: string
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
          this.db.collection(SLOTS_COLLECTION)
            .where('venueId', '==', venueId)
            .where('date', '==', approvalDate)
            .limit(100)
        );

        for (const slotDoc of sameDaySnap.docs) {
          if (slotDoc.id === slotId) continue;
          const candidate = slotDoc.data() as Record<string, any>;
          const candidateStatus = normalizeLegacyStatus(safeStr(candidate.status || candidate.slotStatus || 'open'));
          if (!['approved', 'occupied', 'blocked'].includes(candidateStatus)) continue;

          const candidateStart = safeStr(candidate.requestedStartTime || candidate.startTime);
          const candidateEnd = safeStr(candidate.requestedEndTime || candidate.endTime);
          if (!candidateStart || !candidateEnd) continue;
          if (!timesOverlap(approvalStart, approvalEnd, candidateStart, candidateEnd)) continue;

          const err: any = new Error('Time slot conflict: another event is already scheduled at this time');
          err.statusCode = 409;
          err.code = 'SLOT_CONFLICT';
          throw err;
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
      updatedSlot = this.legacyDocToSlot({
        id: doc.id,
        data: () => ({ ...(doc.data() || {}), ...updates }),
      } as any, venueId);
    });

    this.log.info(
      { service: 'SchedulingService', method: 'updateSlotStatus', venueId, slotId, newStatus: status },
      'Slot status updated'
    );

    return updatedSlot;
  }

  // ── Slot requests (host → venue) ──────────────────────────────────────────

  async getPendingRequests(venueId: string): Promise<VenueSlot[]> {
    const startedAt = Date.now();

    const snap = await this.db
      .collection(SLOTS_COLLECTION)
      .where('venueId', '==', venueId)
      .where('status', 'in', ['pending', 'requested'])
      .orderBy('date', 'asc')
      .limit(100)
      .get()
      .catch((err) => {
        this.log.error(
          { service: 'SchedulingService', method: 'getPendingRequests', venueId, error: err?.message ?? String(err) },
          'Firestore query failed'
        );
        return { docs: [] };
      });

    const durationMs = Date.now() - startedAt;
    if (durationMs > 200) {
      this.log.warn(
        { service: 'SchedulingService', method: 'getPendingRequests', venueId, durationMs },
        'Slow query detected'
      );
    }

    return (snap as any).docs
      .map((doc: any) => this.legacyDocToSlot(doc, venueId))
      .filter((slot: VenueSlot) => slot.status === 'requested');
  }

  async requestSlot(ctx: PartnerContext, input: SlotRequestInput): Promise<VenueSlot> {
    const now = new Date();
    let newSlotId: string | null = null;

    // P0-4: Wrap conflict check + write in a Firestore transaction to prevent
    // TOCTOU race condition that allows double-bookings.
    await this.db.runTransaction(async (txn) => {
      const conflictSnap = await txn.get(
        this.db.collection(SLOTS_COLLECTION)
          .where('venueId', '==', input.venueId)
          .where('date', '==', input.date)
          .limit(100)
      );

      for (const doc of conflictSnap.docs) {
        const d = doc.data() as Record<string, any>;
        const status = normalizeLegacyStatus(safeStr(d.status || d.slotStatus || 'open'));
        if (!['requested', 'approved', 'occupied', 'blocked'].includes(status)) continue;
        if (timesOverlap(input.startTime, input.endTime, safeStr(d.startTime), safeStr(d.endTime))) {
          this.log.warn(
            { service: 'SchedulingService', method: 'requestSlot', venueId: input.venueId, date: input.date, conflictSlotId: doc.id },
            'Slot conflict detected — rejecting request'
          );
          const err: any = new Error('Time slot conflict: another event is already scheduled at this time');
          err.statusCode = 409;
          err.code = 'SLOT_CONFLICT';
          throw err;
        }
      }

      const ref = this.db.collection(SLOTS_COLLECTION).doc();
      newSlotId = ref.id;
      txn.set(ref, {
        venueId: input.venueId,
        date: input.date,
        startTime: input.startTime,
        endTime: input.endTime,
        requestedDate: input.date,
        requestedStartTime: input.startTime,
        requestedEndTime: input.endTime,
        status: 'pending',
        requestedBy: ctx.partnerId,
        hostId: ctx.partnerId,
        approvedBy: null,
        eventId: null,
        notes: input.notes ?? null,
        isActive: true,
        source: 'partner_request',
        createdAt: now,
        updatedAt: now,
      });
    });

    this.log.info(
      { service: 'SchedulingService', method: 'requestSlot', venueId: input.venueId, slotId: newSlotId, hostId: ctx.partnerId },
      'Slot request created via transaction'
    );

    const doc = await this.db.collection(SLOTS_COLLECTION).doc(newSlotId!).get();
    return this.legacyDocToSlot(doc as any, input.venueId);
  }

  async approveRequest(ctx: PartnerContext, venueId: string, slotId: string, notes?: string): Promise<VenueSlot | null> {
    return this.updateSlotStatus(ctx, venueId, slotId, 'approved', notes);
  }

  async rejectRequest(ctx: PartnerContext, venueId: string, slotId: string, notes?: string): Promise<VenueSlot | null> {
    return this.updateSlotStatus(ctx, venueId, slotId, 'rejected', notes);
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  private docToSlot(
    doc: FirebaseFirestore.DocumentSnapshot | FirebaseFirestore.QueryDocumentSnapshot,
    venueId: string
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
    venueId: string
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

function timesOverlap(startA: string, endA: string, startB: string, endB: string): boolean {
  return startA < endB && endA > startB;
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
