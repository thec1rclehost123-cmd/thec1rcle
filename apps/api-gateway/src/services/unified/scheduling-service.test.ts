import { describe, expect, it } from 'vitest';
import { SchedulingService } from './scheduling-service.js';
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
