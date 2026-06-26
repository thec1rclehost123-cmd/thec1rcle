import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./admin.js', () => ({
  getAdminDb: vi.fn(),
}));

vi.mock('./inventory-engine.js', () => ({
  releaseReservation: vi.fn(async () => ({ success: true })),
}));

import { generateTicketsForOrder, getUserTicketWallet } from './ticket-checkout-wallet-service.js';

process.env.QR_SECRET = 'test-qr-secret';
const BOOKING_CODE_RE = /^[A-HJ-KM-NP-Z2-9]{6}$/;

class FakeDocSnapshot {
  constructor(ref, data) {
    this.ref = ref;
    this.id = ref.id;
    this.exists = data !== undefined;
    this._data = data;
  }

  data() {
    return this._data;
  }
}

class FakeQuerySnapshot {
  constructor(docs) {
    this.docs = docs;
    this.empty = docs.length === 0;
    this.size = docs.length;
  }
}

class FakeDocRef {
  constructor(db, collectionName, id) {
    this.db = db;
    this.collectionName = collectionName;
    this.id = id;
  }

  async get() {
    return new FakeDocSnapshot(this, this.db.getCollection(this.collectionName).get(this.id));
  }

  async set(value) {
    this.db.getCollection(this.collectionName).set(this.id, { ...value });
  }

  async update(value) {
    const collection = this.db.getCollection(this.collectionName);
    const existing = collection.get(this.id) || {};
    collection.set(this.id, { ...existing, ...value });
  }

  collection(name) {
    return new FakeCollectionRef(this.db, `${this.collectionName}/${this.id}/${name}`);
  }
}

class FakeQuery {
  constructor(db, collectionName) {
    this.db = db;
    this.collectionName = collectionName;
    this.filters = [];
    this.limitValue = null;
  }

  where(field, op, value) {
    this.filters.push({ field, op, value });
    return this;
  }

  limit(value) {
    this.limitValue = value;
    return this;
  }

  async get() {
    let docs = [...this.db.getCollection(this.collectionName).entries()].map(
      ([id, data]) => new FakeDocSnapshot(new FakeDocRef(this.db, this.collectionName, id), data),
    );
    for (const filter of this.filters) {
      if (filter.field === '__name__' && filter.op === 'in') {
        docs = docs.filter((doc) => filter.value.includes(doc.id));
      } else {
        docs = docs.filter((doc) => doc.data()?.[filter.field] === filter.value);
      }
    }
    if (this.limitValue) docs = docs.slice(0, this.limitValue);
    return new FakeQuerySnapshot(docs);
  }
}

class FakeCollectionRef extends FakeQuery {
  doc(id) {
    return new FakeDocRef(this.db, this.collectionName, id);
  }
}

class FakeTransaction {
  async get(refOrQuery) {
    return refOrQuery.get();
  }

  set(ref, value) {
    return ref.set(value);
  }

  update(ref, value) {
    return ref.update(value);
  }
}

class FakeDb {
  constructor(seed = {}) {
    this.collections = new Map(
      Object.entries(seed).map(([name, values]) => [name, new Map(Object.entries(values))]),
    );
  }

  getCollection(name) {
    if (!this.collections.has(name)) this.collections.set(name, new Map());
    return this.collections.get(name);
  }

  collection(name) {
    return new FakeCollectionRef(this, name);
  }

  async runTransaction(callback) {
    return callback(new FakeTransaction());
  }
}

function buildOrder(overrides = {}) {
  return {
    id: 'ord_free',
    eventId: 'event_1',
    eventName: 'After Dark',
    eventDate: '2099-01-01T20:00:00.000Z',
    userId: 'user_1',
    userEmail: 'guest@example.com',
    status: 'confirmed',
    tickets: [
      {
        ticketId: 'ga',
        name: 'General Admission',
        quantity: 2,
        price: 0,
        total: 0,
      },
    ],
    totalAmount: 0,
    createdAt: '2026-06-23T00:00:00.000Z',
    ...overrides,
  };
}

describe('ticket checkout wallet service', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'test';
  });

  it('creates wallet ticket docs for confirmed free orders and returns them in the wallet', async () => {
    const db = new FakeDb({
      orders: { ord_free: buildOrder() },
      events: {
        event_1: {
          title: 'After Dark',
          startDate: '2099-01-01T20:00:00.000Z',
          venueName: 'Club Room',
        },
      },
    });

    const result = await generateTicketsForOrder({ db, orderId: 'ord_free' });
    const wallet = await getUserTicketWallet({ db, userId: 'user_1' });

    expect(result.tickets).toHaveLength(2);
    expect(db.getCollection('tickets').size).toBe(2);
    expect(result.tickets[0].bookingCode).toMatch(BOOKING_CODE_RE);
    expect(result.tickets[1].bookingCode).toMatch(BOOKING_CODE_RE);
    expect(result.tickets[0].bookingCode).not.toBe(result.tickets[1].bookingCode);
    expect(result.tickets[0]).toMatchObject({
      bookingCode: result.tickets[0].bookingCode,
      qrMode: 'raw_id',
      qrData: result.tickets[0].id,
      qrPayload: result.tickets[0].id,
      qrJwt: null,
    });
    expect(db.getCollection('orders').get('ord_free')).toMatchObject({
      bookingCode: result.tickets[0].bookingCode,
      bookingCodes: expect.arrayContaining([
        expect.objectContaining({
          ticketId: result.tickets[0].id,
          bookingCode: result.tickets[0].bookingCode,
        }),
        expect.objectContaining({
          ticketId: result.tickets[1].id,
          bookingCode: result.tickets[1].bookingCode,
        }),
      ]),
      ticketIds: expect.arrayContaining(result.tickets.map((ticket) => ticket.id)),
      qrCodes: expect.arrayContaining([
        expect.objectContaining({
          bookingCode: result.tickets[0].bookingCode,
          qrMode: 'raw_id',
          qrCode: result.tickets[0].id,
          qrData: result.tickets[0].id,
          qrPayload: result.tickets[0].id,
        }),
      ]),
      ticketsIssuedAt: expect.any(String),
      confirmedAt: expect.any(String),
    });
    expect(wallet.orders).toHaveLength(1);
    expect(wallet.orders[0]).toMatchObject({
      id: 'ord_free',
      eventTitle: 'After Dark',
      eventDate: '2099-01-01T20:00:00.000Z',
    });
  });

  it('creates wallet ticket docs for confirmed RSVP orders in rsvp_orders', async () => {
    const db = new FakeDb({
      rsvp_orders: {
        RSVP_1: buildOrder({
          id: 'RSVP_1',
          isRSVP: true,
          source: 'rsvp',
          tickets: [{ ticketId: 'rsvp', name: 'RSVP', quantity: 1, price: 0, total: 0 }],
        }),
      },
    });

    const result = await generateTicketsForOrder({
      db,
      orderId: 'RSVP_1',
      orderCollection: 'rsvp_orders',
    });
    const second = await generateTicketsForOrder({
      db,
      orderId: 'RSVP_1',
      orderCollection: 'rsvp_orders',
    });
    const wallet = await getUserTicketWallet({ db, userId: 'user_1' });

    expect(result.tickets).toHaveLength(1);
    expect(second.createdTicketCount).toBe(0);
    expect(result.tickets[0].bookingCode).toMatch(BOOKING_CODE_RE);
    expect(second.tickets[0].bookingCode).toBe(result.tickets[0].bookingCode);
    expect(second.tickets[0]).toMatchObject({
      bookingCode: result.tickets[0].bookingCode,
      qrMode: 'raw_id',
      qrData: second.tickets[0].id,
      qrPayload: second.tickets[0].id,
      qrJwt: null,
    });
    expect(db.getCollection('tickets').size).toBe(1);
    expect(db.getCollection('rsvp_orders').get('RSVP_1')).toMatchObject({
      isRSVP: true,
      bookingCode: result.tickets[0].bookingCode,
      ticketIds: [result.tickets[0].id],
    });
    expect(wallet.orders).toHaveLength(1);
    expect(wallet.orders[0]).toMatchObject({ id: 'RSVP_1', isRSVP: true, source: 'rsvp' });
  });
});
