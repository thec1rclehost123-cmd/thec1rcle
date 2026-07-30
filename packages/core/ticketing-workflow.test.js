import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildCoverWalletDocumentsForOrder,
  finalizeFreeTicketOrder,
  finalizationArtifactMatches,
  signTicketJwt,
  verifyRazorpayCheckoutSignature,
} from './workflows/ticketing.js';

function createFreeFinalizationDb() {
  const documents = new Map();
  const ref = (collection, id) => ({
    id,
    path: `${collection}/${id}`,
  });
  const snapshot = (documentRef) => {
    const value = documents.get(documentRef.path);
    return {
      id: documentRef.id,
      exists: value !== undefined,
      data: () => value,
    };
  };
  const db = {
    documents,
    collection(collection) {
      return {
        doc(id) {
          return ref(collection, id);
        },
      };
    },
    async runTransaction(handler) {
      return handler({
        get: async (documentRef) => snapshot(documentRef),
        create(documentRef, value) {
          if (documents.has(documentRef.path)) throw new Error('already exists');
          documents.set(documentRef.path, structuredClone(value));
        },
        update(documentRef, updates) {
          const current = documents.get(documentRef.path);
          if (!current) throw new Error(`missing ${documentRef.path}`);
          documents.set(documentRef.path, { ...current, ...structuredClone(updates) });
        },
      });
    },
  };

  documents.set('events/event_free_1', {
    id: 'event_free_1',
    title: 'Free Event',
    hostId: 'host_1',
    venueId: 'venue_1',
    startAt: '2026-07-31T16:00:00.000Z',
    tickets: [
      {
        id: 'general',
        name: 'General Admission',
        price: 0,
        quantity: 50,
      },
    ],
  });
  documents.set('orders/order_free_1', {
    id: 'order_free_1',
    eventId: 'event_free_1',
    eventName: 'Free Event',
    hostId: 'host_1',
    venueId: 'venue_1',
    userId: 'guest_1',
    userEmail: 'guest@example.test',
    totalPaise: 0,
    totalAmount: 0,
    status: 'confirmed',
    reservationId: 'reservation_free_1',
    tickets: [
      {
        ticketId: 'general',
        name: 'General Admission',
        price: 0,
        quantity: 1,
        entryType: 'general',
      },
    ],
  });
  documents.set('domain_event_outbox/ticket-purchase-order_free_1', {
    id: 'ticket-purchase-order_free_1',
    orderId: 'order_free_1',
    status: 'dispatched',
  });

  return db;
}

describe('ticketing checkout verification primitives', () => {
  it('atomically finalizes a free order once without payment or revenue ledger records', async () => {
    const db = createFreeFinalizationDb();

    const first = await finalizeFreeTicketOrder({
      db,
      orderId: 'order_free_1',
      userId: 'guest_1',
    });
    const second = await finalizeFreeTicketOrder({
      db,
      orderId: 'order_free_1',
      userId: 'guest_1',
    });

    expect(first.alreadyFinalized).toBe(false);
    expect(second.alreadyFinalized).toBe(true);
    expect(first.ticketIds).toHaveLength(1);
    expect(first.entitlementIds).toHaveLength(1);

    const ticket = db.documents.get(`tickets/${first.ticketIds[0]}`);
    const entitlement = db.documents.get(`entitlements/${first.entitlementIds[0]}`);
    const event = db.documents.get('events/event_free_1');
    const order = db.documents.get('orders/order_free_1');

    expect(ticket).toMatchObject({
      orderId: 'order_free_1',
      tierId: 'general',
      ticketType: 'free',
      status: 'active',
    });
    expect(entitlement).toMatchObject({
      orderId: 'order_free_1',
      ownerUserId: 'guest_1',
      ticketType: 'free',
      state: 'ACTIVE',
      publicToken: expect.stringMatching(/^stk_/),
    });
    expect(event.tickets[0]).toMatchObject({
      quantity: 50,
      remaining: 49,
      soldQuantity: 1,
    });
    expect(order).toMatchObject({
      fulfillmentStatus: 'authoritative_committed',
      ticketIds: first.ticketIds,
      entitlementIds: first.entitlementIds,
    });
    expect([...db.documents.keys()].filter((key) => key.startsWith('tickets/'))).toHaveLength(1);
    expect(
      [...db.documents.keys()].filter((key) => key.startsWith('entitlements/')),
    ).toHaveLength(1);
    expect([...db.documents.keys()].filter((key) => key.startsWith('payments/'))).toHaveLength(0);
    expect(
      [...db.documents.keys()].filter((key) => key.startsWith('partner_ledger/')),
    ).toHaveLength(0);
  });

  it('verifies Razorpay payment signatures with the official SDK utility', () => {
    const keySecret = 'rzp_test_secret';
    const signature = createHmac('sha256', keySecret).update('order_rzp_1|pay_1').digest('hex');

    expect(
      verifyRazorpayCheckoutSignature({
        razorpayOrderId: 'order_rzp_1',
        razorpayPaymentId: 'pay_1',
        razorpaySignature: signature,
        keySecret,
      }),
    ).toBe(true);

    expect(() =>
      verifyRazorpayCheckoutSignature({
        razorpayOrderId: 'order_rzp_1',
        razorpayPaymentId: 'pay_1',
        razorpaySignature: 'bad_signature',
        keySecret,
      }),
    ).toThrow('Invalid signature');
  });

  it('generates a signed JWT string for ticket QR payloads', () => {
    const jwt = signTicketJwt(
      {
        iss: 'the-c1rcle',
        aud: 'c1rcle-scanner',
        typ: 'ticket',
        sub: 'ticket_1',
        iat: 1,
        exp: 2,
      },
      'test_qr_secret',
    );

    const parts = jwt.split('.');
    expect(parts).toHaveLength(3);
    expect(parts[0]).not.toContain('=');
    expect(parts[1]).not.toContain('=');
    expect(parts[2]).not.toContain('=');
  });

  it('builds one deterministic Cover wallet for every purchased admission unit', () => {
    const issuedAt = '2026-07-27T12:00:00.000Z';
    const wallets = buildCoverWalletDocumentsForOrder(
      {
        id: 'order_cover_1',
        eventId: 'event_cover_1',
        venueId: 'venue_1',
        userId: 'user_1',
        createdAt: issuedAt,
        coverChargeTermsAcceptedAt: issuedAt,
        tickets: [
          {
            ticketId: 'tier_cover',
            quantity: 2,
            coverChargeConfig: {
              enabled: true,
              walletAmountPaise: 50_000,
              terminationHour: 5,
              terminationPolicy: 'forfeit',
              partialRefundPercent: 0,
              presetItems: [],
            },
          },
          {
            ticketId: 'tier_standard',
            quantity: 3,
          },
        ],
      },
      {
        id: 'event_cover_1',
        venueId: 'venue_1',
        startAt: '2026-07-27T22:00:00+05:30',
        timezoneOffset: '+05:30',
      },
      issuedAt,
    );

    expect(wallets).toHaveLength(2);
    expect(wallets.map((wallet) => wallet.unitIndex)).toEqual([1, 2]);
    expect(new Set(wallets.map((wallet) => wallet.id)).size).toBe(2);
    expect(wallets).toEqual([
      expect.objectContaining({
        orderId: 'order_cover_1',
        eventId: 'event_cover_1',
        venueId: 'venue_1',
        userId: 'user_1',
        tierId: 'tier_cover',
        openingBalancePaise: 50_000,
        currentBalancePaise: 50_000,
        state: 'ACTIVE',
      }),
      expect.objectContaining({
        orderId: 'order_cover_1',
        eventId: 'event_cover_1',
        venueId: 'venue_1',
        userId: 'user_1',
        tierId: 'tier_cover',
        openingBalancePaise: 50_000,
        currentBalancePaise: 50_000,
        state: 'ACTIVE',
      }),
    ]);
  });

  it('fails immutable Cover Wallet conflicts while allowing legitimate mutable state changes', () => {
    const expected = {
      id: 'wallet_1',
      orderId: 'order_1',
      eventId: 'event_1',
      venueId: 'venue_1',
      userId: 'original_owner',
      tierId: 'cover',
      unitIndex: 1,
      schemaVersion: 2,
      terminationAtMs: 1_785_217_400_000,
      openingBalancePaise: 50_000,
      currentBalancePaise: 50_000,
      state: 'ACTIVE',
      rules: { currency: 'INR', terminationPolicy: 'forfeit' },
      termsAcceptedAt: '2026-07-27T12:00:00.000Z',
      termsVersion: '1.0',
      createdBy: 'checkout_service',
    };

    expect(
      finalizationArtifactMatches(
        'coverWallet',
        {
          ...expected,
          userId: 'transferred_owner',
          currentBalancePaise: 25_000,
          state: 'FROZEN',
        },
        expected,
      ),
    ).toBe(true);
    expect(
      finalizationArtifactMatches(
        'coverWallet',
        { ...expected, openingBalancePaise: 500_000 },
        expected,
      ),
    ).toBe(false);
    expect(
      finalizationArtifactMatches('coverWallet', { ...expected, venueId: 'other_venue' }, expected),
    ).toBe(false);
  });
});
