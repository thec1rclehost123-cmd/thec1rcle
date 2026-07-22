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
    this.orderByValue = null;
  }

  where(field, op, value) {
    this.filters.push({ field, op, value });
    return this;
  }

  limit(value) {
    this.limitValue = value;
    return this;
  }

  orderBy(field, direction = 'asc') {
    this.orderByValue = { field, direction };
    return this;
  }

  async get() {
    let docs = [...this.db.getCollection(this.collectionName).entries()].map(
      ([id, data]) => new FakeDocSnapshot(new FakeDocRef(this.db, this.collectionName, id), data),
    );
    for (const filter of this.filters) {
      if (filter.field === '__name__' && filter.op === 'in') {
        docs = docs.filter((doc) => filter.value.includes(doc.id));
      } else if (filter.op === 'in') {
        docs = docs.filter((doc) => filter.value.includes(doc.data()?.[filter.field]));
      } else {
        docs = docs.filter((doc) => doc.data()?.[filter.field] === filter.value);
      }
    }
    if (this.orderByValue) {
      const { field, direction } = this.orderByValue;
      docs.sort((left, right) => {
        const comparison = String(left.data()?.[field] || '').localeCompare(
          String(right.data()?.[field] || ''),
        );
        return direction === 'desc' ? -comparison : comparison;
      });
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
          isClaimed: true,
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

  it('keeps a newly purchased ticket visible after more than twenty historical tickets', async () => {
    const orders = {};
    const tickets = {};
    for (let index = 0; index < 25; index += 1) {
      const orderId = `old_${index}`;
      const createdAt = `2026-01-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`;
      orders[orderId] = buildOrder({ id: orderId, createdAt });
      tickets[`ticket_${orderId}`] = {
        id: `ticket_${orderId}`,
        ticketId: `ticket_${orderId}`,
        orderId,
        eventId: 'event_1',
        userId: 'user_1',
        status: 'active',
        createdAt,
      };
    }

    orders.newest = buildOrder({ id: 'newest', createdAt: '2026-07-16T23:00:00.000Z' });
    tickets.ticket_newest = {
      id: 'ticket_newest',
      ticketId: 'ticket_newest',
      orderId: 'newest',
      eventId: 'event_1',
      userId: 'user_1',
      status: 'active',
      createdAt: '2026-07-16T23:00:00.000Z',
    };

    const db = new FakeDb({
      orders,
      tickets,
      events: {
        event_1: {
          title: 'After Dark',
          startDate: '2099-02-01T20:00:00.000Z',
          venueName: 'Club Room',
        },
      },
    });

    const wallet = await getUserTicketWallet({ db, userId: 'user_1' });
    const newestOrder = wallet.orders.find((order) => order.id === 'newest');

    expect(newestOrder).toBeDefined();
    expect(newestOrder.eventDate).toBe('2099-02-01T20:00:00.000Z');
  });

  it('moves a transferred ticket out of the sender wallet and into the recipient wallet', async () => {
    const order = buildOrder({
      id: 'ord_transfer',
      userId: 'sender_1',
      tickets: [{ ticketId: 'ga', name: 'General Admission', quantity: 1, price: 500 }],
    });
    const db = new FakeDb({
      orders: { ord_transfer: order },
      tickets: {
        'TKT-ORD_TRANSFER-GA-1': {
          id: 'TKT-ORD_TRANSFER-GA-1',
          orderId: 'ord_transfer',
          eventId: 'event_1',
          userId: 'sender_1',
          tierId: 'ga',
          tierName: 'General Admission',
          bookingCode: 'ABC234',
          status: 'transferred',
          createdAt: '2026-07-16T23:00:00.000Z',
        },
      },
      ticket_assignments: {
        'TRANS-TKT-ORD_TRANSFER-GA-1-RECIPIENT': {
          assignmentId: 'TRANS-TKT-ORD_TRANSFER-GA-1-RECIPIENT',
          originalTicketId: 'TKT-ORD_TRANSFER-GA-1',
          orderId: 'ord_transfer',
          eventId: 'event_1',
          tierId: 'ga',
          redeemerId: 'recipient_1',
          status: 'active',
          qrPayload: 'signed-recipient-qr',
          receivedFrom: 'Sender One',
          createdAt: '2026-07-16T23:01:00.000Z',
        },
      },
      events: {
        event_1: {
          title: 'After Dark',
          startDate: '2099-02-01T20:00:00.000Z',
          venueName: 'Club Room',
        },
      },
    });

    const senderWallet = await getUserTicketWallet({ db, userId: 'sender_1' });
    const recipientWallet = await getUserTicketWallet({ db, userId: 'recipient_1' });

    expect(senderWallet.orders).toHaveLength(0);
    expect(senderWallet.tickets).toHaveLength(0);
    expect(recipientWallet.orders).toHaveLength(1);
    expect(recipientWallet.orders[0]).toMatchObject({
      id: 'ord_transfer',
      userId: 'recipient_1',
      source: 'transfer',
      tickets: [
        expect.objectContaining({
          quantity: 1,
          receivedFrom: 'Sender One',
        }),
      ],
      qrCodes: [
        expect.objectContaining({
          ticketId: 'TRANS-TKT-ORD_TRANSFER-GA-1-RECIPIENT',
          qrCode: 'signed-recipient-qr',
        }),
      ],
    });
    expect(recipientWallet.tickets).toEqual([
      expect.objectContaining({
        id: 'TRANS-TKT-ORD_TRANSFER-GA-1-RECIPIENT',
        qrPayload: 'signed-recipient-qr',
      }),
    ]);
  });

  it('shows a claimed share slot only in the claimant wallet', async () => {
    const order = buildOrder({
      id: 'ord_share',
      userId: 'sender_1',
      tickets: [{ ticketId: 'ga', name: 'General Admission', quantity: 3, price: 500 }],
    });
    const ticketSeed = {};
    for (let slotIndex = 1; slotIndex <= 3; slotIndex += 1) {
      ticketSeed[`TKT-ORD_SHARE-GA-${slotIndex}`] = {
        id: `TKT-ORD_SHARE-GA-${slotIndex}`,
        ticketId: `ord_share-ga-${slotIndex}`,
        orderId: 'ord_share',
        eventId: 'event_1',
        userId: 'sender_1',
        tierId: 'ga',
        tierName: 'General Admission',
        slotIndex,
        status: slotIndex === 2 ? 'shared' : 'active',
        createdAt: `2026-07-16T23:00:0${slotIndex}.000Z`,
      };
    }
    const db = new FakeDb({
      orders: { ord_share: order },
      tickets: ticketSeed,
      ticket_assignments: {
        claim_1: {
          assignmentId: 'claim_1',
          bundleId: 'share_1',
          orderId: 'ord_share',
          eventId: 'event_1',
          tierId: 'ga',
          slotIndex: 2,
          redeemerId: 'recipient_1',
          status: 'active',
          qrPayload: { token: 'signed-claimant-qr', issuedAt: 1 },
          createdAt: '2026-07-16T23:01:00.000Z',
        },
      },
      events: {
        event_1: {
          title: 'After Dark',
          startDate: '2099-02-01T20:00:00.000Z',
          venueName: 'Club Room',
        },
      },
    });

    const senderWallet = await getUserTicketWallet({ db, userId: 'sender_1' });
    const recipientWallet = await getUserTicketWallet({ db, userId: 'recipient_1' });

    expect(senderWallet.tickets).toHaveLength(2);
    expect(senderWallet.orders[0].tickets).toEqual([
      expect.objectContaining({ tierId: 'ga', quantity: 2 }),
    ]);
    expect(recipientWallet.orders).toHaveLength(1);
    expect(recipientWallet.orders[0]).toMatchObject({
      userId: 'recipient_1',
      source: 'transfer',
      qrCodes: [expect.objectContaining({ ticketId: 'claim_1', qrCode: 'signed-claimant-qr' })],
    });
  });

  it('provisions a pending cover wallet when a confirmed order includes a cover tier', async () => {
    const db = new FakeDb({
      orders: {
        ord_cover: buildOrder({
          id: 'ord_cover',
          venueId: 'venue_1',
          userName: 'Arjun Mehta',
          tickets: [
            {
              ticketId: 'cover',
              name: 'Cover Charge Entry',
              quantity: 1,
              price: 1500,
              total: 1500,
            },
          ],
          totalAmount: 1500,
        }),
      },
      events: {
        event_1: {
          title: 'After Dark',
          startDate: '2099-01-01T20:00:00.000Z',
          venueId: 'venue_1',
          ticketCatalog: {
            tiers: [
              {
                id: 'cover',
                name: 'Cover Charge Entry',
                coverChargeConfig: {
                  enabled: true,
                  walletAmountPaise: 100000,
                  minChargeAmountPaise: 1000,
                  maxChargeAmountPaise: 100000,
                  presetItems: [
                    {
                      id: 'beer',
                      name: 'Beer',
                      amountPaise: 40000,
                      isAvailable: true,
                      sortOrder: 1,
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    });

    const result = await generateTicketsForOrder({ db, orderId: 'ord_cover' });
    const wallets = [...db.getCollection('cover_wallets').values()];

    expect(result.tickets).toHaveLength(1);
    expect(result.coverWallets).toHaveLength(1);
    expect(wallets).toHaveLength(1);
    expect(wallets[0]).toMatchObject({
      orderId: 'ord_cover',
      eventId: 'event_1',
      venueId: 'venue_1',
      userId: 'user_1',
      guestFirstName: 'Arjun',
      state: 'PENDING',
      openingBalancePaise: 100000,
      currentBalancePaise: 100000,
      rules: expect.objectContaining({
        minChargeAmountPaise: 1000,
        maxChargeAmountPaise: 100000,
        allowedPresetItems: [
          expect.objectContaining({
            id: 'beer',
            amountPaise: 40000,
            isAvailable: true,
          }),
        ],
      }),
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
