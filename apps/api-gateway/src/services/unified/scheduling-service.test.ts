import { describe, expect, it } from 'vitest';
import { SchedulingService, schedulingRangesOverlap } from './scheduling-service.js';
import { MockFirestore } from '../../test-utils/mock-firestore.js';

const venueCtx = {
  partnerId: 'venue_1',
  uid: 'user_1',
  type: 'venue' as const,
  roles: ['venue_owner' as const],
  venueIds: [],
  displayName: 'Venue One',
};

describe('SchedulingService', () => {
  it('fails closed when the calendar authority is unavailable', async () => {
    const failingDb = {
      collection: () => ({
        where: () => ({
          where: () => ({
            where: () => ({
              orderBy: () => ({
                limit: () => ({
                  get: async () => {
                    throw new Error('firestore unavailable');
                  },
                }),
              }),
            }),
          }),
        }),
      }),
    };
    const service = new SchedulingService(failingDb as any);

    await expect(
      service.getCalendar('venue-1', {
        startDate: '2026-08-01',
        endDate: '2026-08-31',
      }),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'SCHEDULING_DATA_UNAVAILABLE',
    });
  });

  it('uses a bounded venue-only fallback while the composite calendar index builds', async () => {
    const primaryQuery: any = {
      where: () => primaryQuery,
      orderBy: () => primaryQuery,
      limit: () => primaryQuery,
      get: async () => {
        const error: any = new Error('The query requires an index');
        error.code = 9;
        throw error;
      },
    };
    const fallbackDocs = [
      {
        id: 'inside',
        data: () => ({
          venueId: 'venue_1',
          date: '2026-08-10',
          startTime: '21:00',
          endTime: '03:00',
          status: 'open',
        }),
      },
      {
        id: 'outside',
        data: () => ({
          venueId: 'venue_1',
          date: '2026-09-10',
          startTime: '21:00',
          endTime: '03:00',
          status: 'open',
        }),
      },
    ];
    const fallbackQuery: any = {
      where: () => fallbackQuery,
      limit: () => fallbackQuery,
      get: async () => ({ docs: fallbackDocs }),
    };
    let collectionCalls = 0;
    const service = new SchedulingService({
      collection: () => {
        collectionCalls += 1;
        return collectionCalls === 1 ? primaryQuery : fallbackQuery;
      },
    } as any);

    const slots = await service.getCalendar('venue_1', {
      startDate: '2026-08-01',
      endDate: '2026-08-31',
    });

    expect(slots.map((slot) => slot.slotId)).toEqual(['inside']);
    expect(collectionCalls).toBe(2);
  });

  it('detects overlap across the nightlife midnight boundary', () => {
    expect(schedulingRangesOverlap('21:00', '03:00', '01:00', '02:00')).toBe(true);
    expect(schedulingRangesOverlap('21:00', '23:00', '01:00', '02:00')).toBe(false);
    expect(schedulingRangesOverlap('18:00', '21:00', '21:00', '23:00')).toBe(false);
  });

  it('allows separate time ranges on the same day', async () => {
    const db = new MockFirestore();
    db.seed('availability_slots/early_event', {
      venueId: 'venue_1',
      date: '2026-05-01',
      startTime: '18:00',
      endTime: '21:00',
      status: 'approved',
    });
    const service = new SchedulingService(db as any);

    await expect(
      service.createSlot(venueCtx as any, 'venue_1', {
        date: '2026-05-01',
        startTime: '21:00',
        endTime: '23:00',
        status: 'open',
      }),
    ).resolves.toMatchObject({
      venueId: 'venue_1',
      date: '2026-05-01',
      startTime: '21:00',
      endTime: '23:00',
    });
  });

  it('uses the event id as the idempotent slot-request document', async () => {
    const db = new MockFirestore();
    const service = new SchedulingService(db as any);
    const hostCtx = {
      ...venueCtx,
      partnerId: 'host_1',
      type: 'host' as const,
      roles: ['host_owner' as const],
    };

    await service.requestSlot(hostCtx as any, {
      eventId: 'event_1',
      venueId: 'venue_1',
      date: '2026-05-10',
      startTime: '21:00',
      endTime: '03:00',
    });
    await service.requestSlot(hostCtx as any, {
      eventId: 'event_1',
      venueId: 'venue_1',
      date: '2026-05-10',
      startTime: '21:00',
      endTime: '03:00',
    });

    expect(db.getDoc('availability_slots/event_1')).toMatchObject({
      eventId: 'event_1',
      hostId: 'host_1',
      status: 'pending',
    });
    expect(db.listCollection('availability_slots')).toHaveLength(1);
  });

  it('rejects an overnight conflict for a deterministic event request', async () => {
    const db = new MockFirestore();
    db.seed('availability_slots/existing_event', {
      venueId: 'venue_1',
      date: '2026-05-11',
      startTime: '21:00',
      endTime: '03:00',
      status: 'approved',
    });
    const service = new SchedulingService(db as any);
    const hostCtx = {
      ...venueCtx,
      partnerId: 'host_1',
      type: 'host' as const,
      roles: ['host_owner' as const],
    };

    await expect(
      service.requestSlot(hostCtx as any, {
        eventId: 'event_2',
        venueId: 'venue_1',
        date: '2026-05-11',
        startTime: '01:00',
        endTime: '02:00',
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'SLOT_CONFLICT',
    });
  });

  it('rejects overlapping direct venue slot creation', async () => {
    const db = new MockFirestore();
    db.seed('availability_slots/existing_block', {
      venueId: 'venue_1',
      date: '2026-05-01',
      startTime: '18:00',
      endTime: '22:00',
      requestedDate: '2026-05-01',
      requestedStartTime: '18:00',
      requestedEndTime: '22:00',
      status: 'blocked',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const service = new SchedulingService(db as any);

    await expect(
      service.createSlot(venueCtx as any, 'venue_1', {
        date: '2026-05-01',
        startTime: '20:00',
        endTime: '23:00',
        status: 'blocked',
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'SLOT_CONFLICT',
    });
  });

  it('marks rejected requests durably as rejected', async () => {
    const db = new MockFirestore();
    db.seed('availability_slots/request_1', {
      venueId: 'venue_1',
      date: '2026-05-02',
      startTime: '19:00',
      endTime: '21:00',
      requestedDate: '2026-05-02',
      requestedStartTime: '19:00',
      requestedEndTime: '21:00',
      status: 'pending',
      requestedBy: 'host_1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const service = new SchedulingService(db as any);
    const updated = await service.rejectRequest(
      venueCtx as any,
      'venue_1',
      'request_1',
      'No availability',
    );

    expect(updated?.status).toBe('rejected');
    expect(db.getDoc('availability_slots/request_1')?.status).toBe('rejected');
  });

  it('re-checks conflicts before approval', async () => {
    const db = new MockFirestore();
    db.seed('availability_slots/approved_1', {
      venueId: 'venue_1',
      date: '2026-05-03',
      startTime: '18:00',
      endTime: '22:00',
      requestedDate: '2026-05-03',
      requestedStartTime: '18:00',
      requestedEndTime: '22:00',
      status: 'approved',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    db.seed('availability_slots/request_2', {
      venueId: 'venue_1',
      date: '2026-05-03',
      startTime: '19:00',
      endTime: '21:00',
      requestedDate: '2026-05-03',
      requestedStartTime: '19:00',
      requestedEndTime: '21:00',
      status: 'pending',
      requestedBy: 'host_2',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const service = new SchedulingService(db as any);

    await expect(
      service.approveRequest(venueCtx as any, 'venue_1', 'request_2'),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'SLOT_CONFLICT',
    });
  });

  it('rejects slots, requests, and approvals when a full-day block exists', async () => {
    const db = new MockFirestore();
    db.seed('availability_slots/full_day_block', {
      venueId: 'venue_1',
      date: '2026-05-05',
      startTime: null,
      endTime: null,
      requestedDate: '2026-05-05',
      requestedStartTime: null,
      requestedEndTime: null,
      status: 'blocked',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const service = new SchedulingService(db as any);

    // 1. Rejects createSlot on blocked day
    await expect(
      service.createSlot(venueCtx as any, 'venue_1', {
        date: '2026-05-05',
        startTime: '18:00',
        endTime: '22:00',
        status: 'open',
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'SLOT_CONFLICT',
    });

    // 2. Rejects requestSlot on blocked day
    await expect(
      service.requestSlot(venueCtx as any, {
        venueId: 'venue_1',
        date: '2026-05-05',
        startTime: '18:00',
        endTime: '22:00',
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'SLOT_CONFLICT',
    });

    // 3. Rejects approveRequest on blocked day
    db.seed('availability_slots/pending_request', {
      venueId: 'venue_1',
      date: '2026-05-05',
      startTime: '18:00',
      endTime: '22:00',
      requestedDate: '2026-05-05',
      requestedStartTime: '18:00',
      requestedEndTime: '22:00',
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    await expect(
      service.approveRequest(venueCtx as any, 'venue_1', 'pending_request'),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'SLOT_CONFLICT',
    });
  });
});
