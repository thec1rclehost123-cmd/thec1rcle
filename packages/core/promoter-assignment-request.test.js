import { describe, expect, it } from 'vitest';
import {
  PromoterAssignmentRequestError,
  requestPromoterAssignment,
} from './promoter-assignment-request.js';

class Ref {
  constructor(db, path) {
    this.db = db;
    this.path = path;
  }

  async get() {
    const data = this.db.docs.get(this.path);
    return { exists: data !== undefined, data: () => data };
  }
}

class Collection {
  constructor(db, path) {
    this.db = db;
    this.path = path;
  }

  doc(id) {
    return new Ref(this.db, `${this.path}/${id}`);
  }
}

class Db {
  constructor(seed = {}) {
    this.docs = new Map(Object.entries(seed));
  }

  collection(name) {
    return new Collection(this, name);
  }

  async runTransaction(callback) {
    return callback({
      get: (ref) => ref.get(),
      set: (ref, data, options) => {
        const current = options?.merge ? this.docs.get(ref.path) || {} : {};
        this.docs.set(ref.path, { ...current, ...data });
      },
    });
  }
}

describe('promoter assignment requests', () => {
  it('creates one pending request and one deterministic notification', async () => {
    const db = new Db({
      'events/event_1': {
        title: 'QA Night',
        lifecycle: 'published',
        promotersEnabled: true,
        hostId: 'host_1',
      },
    });

    const first = await requestPromoterAssignment(db, {
      promoterId: 'promoter_1',
      eventId: 'event_1',
      promoterName: 'QA Promoter',
    });
    const replay = await requestPromoterAssignment(db, {
      promoterId: 'promoter_1',
      eventId: 'event_1',
      promoterName: 'QA Promoter',
    });

    expect(first).toMatchObject({ status: 'pending', duplicate: false });
    expect(replay).toMatchObject({ status: 'pending', duplicate: true });
    expect(db.docs.get('promoter_assignment_requests/promoter_1_event_1')).toMatchObject({
      targetPartnerId: 'host_1',
      status: 'pending',
    });
    expect(
      db.docs.get('notifications/promoter_assignment_request_promoter_1_event_1'),
    ).toMatchObject({
      recipientId: 'host_1',
      type: 'promoter_assignment_request',
    });
  });

  it('does not create a request when an active assignment already exists', async () => {
    const db = new Db({
      'events/event_1': {
        lifecycle: 'scheduled',
        promotersEnabled: true,
        venueId: 'venue_1',
      },
      'promoter_assignments/promoter_1_event_1': { status: 'active' },
    });

    await expect(
      requestPromoterAssignment(db, { promoterId: 'promoter_1', eventId: 'event_1' }),
    ).resolves.toMatchObject({ status: 'assigned', alreadyAssigned: true });
    expect(db.docs.has('promoter_assignment_requests/promoter_1_event_1')).toBe(false);
  });

  it('rejects inactive or non-promoter events', async () => {
    const db = new Db({
      'events/event_1': { lifecycle: 'draft', promotersEnabled: true, hostId: 'host_1' },
    });

    await expect(
      requestPromoterAssignment(db, { promoterId: 'promoter_1', eventId: 'event_1' }),
    ).rejects.toEqual(
      expect.objectContaining({
        constructor: PromoterAssignmentRequestError,
        code: 'PROMOTION_NOT_AVAILABLE',
        statusCode: 409,
      }),
    );
  });
});
