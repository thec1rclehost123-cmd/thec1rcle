import { describe, expect, it, beforeEach, afterAll, vi } from 'vitest';
import { CheckoutService } from './src/domain/services/checkout-service.js';
import { buildCheckoutSnapshot } from './src/domain/services/checkout-reconciliation.js';
// @ts-ignore
import {
  createReservation,
  commitInventory,
  releaseReservation,
} from '@c1rcle/core/inventory-engine';
// @ts-ignore
import { cancelOrder as cancelPendingCheckoutOrder } from '@c1rcle/core/order-engine';

vi.mock('./admin.js', () => ({
  getAdminDb: vi.fn(() => ({
    runTransaction: vi.fn(async (cb) => {
      let hasWritten = false;
      return cb({
        get: vi.fn(async () => {
          if (hasWritten) {
            throw new Error(
              'Firestore transactions require all reads to be executed before all writes.',
            );
          }
          return { exists: false, data: () => ({}) };
        }),
        set: vi.fn(() => {
          hasWritten = true;
        }),
        update: vi.fn(),
        delete: vi.fn(),
        collection: vi.fn(() => ({
          doc: vi.fn(() => ({
            get: vi.fn(),
            set: vi.fn(),
          })),
        })),
      });
    }),
    collection: vi.fn((col) => ({
      doc: vi.fn((id) => ({
        update: vi.fn(),
        get: vi.fn(),
        set: vi.fn(),
        collection: vi.fn(() => ({
          doc: vi.fn(() => ({
            get: vi.fn(),
            set: vi.fn(),
          })),
        })),
      })),
    })),
  })),
  getAdminApp: vi.fn(),
  isFirebaseConfigured: () => false,
}));

export let currentOrderRepo: any = null;

vi.mock('@c1rcle/core/order-engine', async (importOriginal) => {
  const mod = await importOriginal<any>();
  return {
    ...mod,
    cancelOrder: vi.fn().mockResolvedValue({ status: 'cancelled' }),
    cleanupStaleOrders: vi.fn().mockResolvedValue({ cleaned: 0, hasMore: false }),
    executeOrderCreation: vi.fn(
      async (transaction, { db, event, orderData, reservationId, inventoryEngine }) => {
        if (typeof transaction?.get === 'function') {
          await transaction.get({ id: 'inventory-read-sentinel' });
        }
        const status =
          orderData.totalAmount === 0 || orderData.isRSVP ? 'confirmed' : 'payment_pending';
        const finalOrder = { ...orderData, status, updatedAt: new Date().toISOString() };
        if (inventoryEngine && !finalOrder.isRSVP) {
          await inventoryEngine.commitInventory(transaction, {
            event,
            items: finalOrder.tickets,
            reservationId,
          });
        }
        if (currentOrderRepo) {
          if (finalOrder.isRSVP) currentOrderRepo.rsvpOrders.set(finalOrder.id, finalOrder);
          else currentOrderRepo.orders.set(finalOrder.id, finalOrder);
          if (reservationId) {
            const res = currentOrderRepo.reservations.get(reservationId);
            if (res)
              currentOrderRepo.reservations.set(reservationId, {
                ...res,
                status: 'converted',
                orderId: finalOrder.id,
              });
          }
        }
        return finalOrder;
      },
    ),
  };
});

vi.mock('@c1rcle/core/inventory-engine', () => ({
  releaseReservation: vi.fn().mockResolvedValue({ success: true }),
  commitInventory: vi.fn().mockResolvedValue({ success: true }),
  createReservation: vi
    .fn()
    .mockResolvedValue({ success: true, reservationId: 'res-mock', expiresAt: '2099-01-01' }),
}));

class FakeOrderRepository {
  orders = new Map<string, any>();
  rsvpOrders = new Map<string, any>();
  reservations = new Map<string, any>();
  payments = new Map<string, any>();

  async getOrderById(id: string) {
    return this.orders.get(id) || this.rsvpOrders.get(id) || null;
  }

  async getOrderByReservationId(reservationId: string) {
    for (const order of [...this.orders.values(), ...this.rsvpOrders.values()]) {
      if (order.reservationId === reservationId) return order;
    }
    return null;
  }

  async createOrder(order: any) {
    const target = order.isRSVP ? this.rsvpOrders : this.orders;
    target.set(order.id, { ...order });
  }

  async updateOrder(id: string, updates: any, isRSVP?: boolean) {
    const existing =
      isRSVP === true
        ? this.rsvpOrders.get(id)
        : isRSVP === false
          ? this.orders.get(id)
          : this.orders.get(id) || this.rsvpOrders.get(id);
    if (!existing) throw new Error('Order not found');
    const next = { ...existing, ...updates };
    if (next.isRSVP) this.rsvpOrders.set(id, next);
    else this.orders.set(id, next);
  }

  async checkExistingRSVP(
    eventId: string,
    lookup: { userId?: string | null; email?: string | null },
  ) {
    for (const order of this.rsvpOrders.values()) {
      if (order.eventId !== eventId || order.status !== 'confirmed') continue;
      if (lookup.userId && order.userId === lookup.userId) return true;
      if (lookup.email && order.userEmail === lookup.email) return true;
    }
    return false;
  }

  async getUserTicketCountForEvent(
    eventId: string,
    lookup: { userId?: string | null; email?: string | null },
  ) {
    let total = 0;
    for (const order of this.orders.values()) {
      if (order.eventId !== eventId || order.status !== 'confirmed') continue;
      if (
        (lookup.userId && order.userId === lookup.userId) ||
        (lookup.email && order.userEmail === lookup.email)
      ) {
        total += (order.tickets || []).reduce(
          (sum: number, ticket: any) => sum + (Number(ticket.quantity) || 0),
          0,
        );
      }
    }
    return total;
  }

  async getReservationById(id: string) {
    return this.reservations.get(id) || null;
  }

  async createReservation(reservation: any) {
    this.reservations.set(reservation.id, { ...reservation });
  }

  async updateReservation(id: string, updates: any) {
    const existing = this.reservations.get(id);
    if (!existing) throw new Error('Reservation not found');
    this.reservations.set(id, { ...existing, ...updates });
  }

  async createPaymentRecord(payment: any) {
    this.payments.set(`${payment.orderId}__${payment.razorpayOrderId}`, payment);
  }

  async updatePaymentRecord(orderId: string, razorpayOrderId: string, updates: any) {
    const key = `${orderId}__${razorpayOrderId}`;
    const existing = this.payments.get(key);
    if (!existing) throw new Error('Payment record not found');
    this.payments.set(key, { ...existing, ...updates });
  }

  async getPaymentRecord(orderId: string, razorpayOrderId: string) {
    return this.payments.get(`${orderId}__${razorpayOrderId}`) || null;
  }

  async getLatestPendingPaymentRecord(orderId: string) {
    return (
      [...this.payments.values()]
        .filter((payment) => payment.orderId === orderId && payment.status === 'initiated')
        .sort(
          (left, right) =>
            Date.parse(String(right.createdAt || 0)) - Date.parse(String(left.createdAt || 0)),
        )[0] || null
    );
  }

  async getPaymentRecordByPaymentId(paymentId: string) {
    for (const payment of this.payments.values()) {
      if (payment.razorpayPaymentId === paymentId) return payment;
    }
    return null;
  }

  async runInTransaction<T>(action: (transaction: any) => Promise<T>) {
    return action({});
  }
}

class FakeEventRepository {
  constructor(private events: Record<string, any>) {}

  async getById(id: string) {
    return this.events[id] || null;
  }

  async getBySlug() {
    throw new Error('Not implemented in tests');
  }

  async list() {
    return [];
  }

  async create() {}

  async update() {}

  async updateLifecycle() {}

  async listNearby() {
    return [];
  }
}

class SequencedEventRepository extends FakeEventRepository {
  private index = 0;

  constructor(private sequence: any[]) {
    super({});
  }

  async getById() {
    const value = this.sequence[Math.min(this.index, this.sequence.length - 1)] || null;
    this.index += 1;
    return value;
  }
}

const futureIso = () => new Date(Date.now() + 60_000).toISOString();
const pastIso = () => new Date(Date.now() - 60_000).toISOString();

function buildEvent({
  id,
  price = 500,
  isRSVP = false,
  lifecycle = 'scheduled',
}: {
  id: string;
  price?: number;
  isRSVP?: boolean;
  lifecycle?: string;
}) {
  return {
    id,
    workspaceId: 'ws_1',
    title: `Event ${id}`,
    cityKey: 'phoenix-us',
    lifecycle,
    startDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    venueId: 'venue_1',
    creatorId: 'creator_1',
    isRSVP,
    tickets: [
      {
        id: 'tier-1',
        name: price === 0 ? 'Guestlist' : 'General Admission',
        entryType: 'general',
        price,
        quantity: 100,
        remaining: 100,
        salesStart: pastIso(),
        salesEnd: futureIso(),
      },
    ],
  };
}

function buildReservation({
  id,
  eventId,
  status = 'active',
  event,
}: {
  id: string;
  eventId: string;
  status?: string;
  event?: any;
}) {
  const items = [
    {
      tierId: 'tier-1',
      tierName: 'General Admission',
      entryType: 'general',
      quantity: 1,
    },
  ];
  const snapshotEvent = event || buildEvent({ id: eventId });
  return {
    id,
    eventId,
    workspaceId: 'ws_1',
    customerId: 'user_1',
    queueId: 'queue_1',
    status,
    items,
    checkoutSnapshot: buildCheckoutSnapshot(snapshotEvent, items),
    createdAt: new Date().toISOString(),
    expiresAt: futureIso(),
  };
}

describe('CheckoutService parity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentOrderRepo = null;
    vi.mocked(createReservation).mockResolvedValue({
      success: true,
      reservationId: 'res-mock',
      expiresAt: '2099-01-01',
    });
    vi.mocked(commitInventory).mockResolvedValue({ success: true });
  });

  it('reuses the same paid order for repeated calls on one reservation', async () => {
    const orderRepo = new FakeOrderRepository();
    currentOrderRepo = orderRepo;
    const event = buildEvent({ id: 'evt-paid', price: 500 });
    const eventRepo = new FakeEventRepository({
      'evt-paid': event,
    });
    orderRepo.reservations.set(
      'res-paid',
      buildReservation({ id: 'res-paid', eventId: 'evt-paid', event }),
    );
    const service = new CheckoutService(orderRepo as any, eventRepo as any);

    const firstResult = await service.initiateCheckout({
      reservationId: 'res-paid',
      userId: 'user_1',
      userName: 'Test User',
      userEmail: 'test@example.com',
      userPhone: '+15555550123',
    });

    orderRepo.reservations.set('res-paid', {
      ...orderRepo.reservations.get('res-paid'),
      status: 'converted',
    });

    const secondResult = await service.initiateCheckout({
      reservationId: 'res-paid',
      userId: 'user_1',
      userName: 'Test User',
      userEmail: 'test@example.com',
      userPhone: '+15555550123',
    });

    expect(firstResult.success).toBe(true);
    expect(firstResult.requiresPayment).toBe(true);
    expect(secondResult.success).toBe(true);
    expect(secondResult.requiresPayment).toBe(true);
    expect(secondResult.order.id).toBe(firstResult.order.id);
    expect(orderRepo.orders.size).toBe(1);
    expect(commitInventory).toHaveBeenCalledTimes(1);
    expect(commitInventory).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        event: expect.objectContaining({ id: 'evt-paid' }),
        reservationId: 'res-paid',
        items: expect.arrayContaining([
          expect.objectContaining({ ticketId: 'tier-1', quantity: 1 }),
        ]),
      }),
    );
  });

  it('reuses the latest pending payment intent for the same order instead of creating a new one', async () => {
    const orderRepo = new FakeOrderRepository();
    currentOrderRepo = orderRepo;
    const event = buildEvent({ id: 'evt-paid', price: 500 });
    const eventRepo = new FakeEventRepository({
      'evt-paid': event,
    });
    orderRepo.reservations.set(
      'res-paid',
      buildReservation({ id: 'res-paid', eventId: 'evt-paid', event }),
    );
    const service = new CheckoutService(orderRepo as any, eventRepo as any);

    const checkout = await service.initiateCheckout({
      reservationId: 'res-paid',
      userId: 'user_1',
      userName: 'Test User',
      userEmail: 'test@example.com',
      userPhone: '+15555550123',
    });

    const firstPayment = await service.preparePayment(checkout.order.id, 'user_1', {
      keyId: '',
      keySecret: '',
      allowMockPayment: true,
    });
    const secondPayment = await service.preparePayment(checkout.order.id, 'user_1', {
      keyId: '',
      keySecret: '',
      allowMockPayment: true,
    });

    expect(firstPayment.razorpayOrderId).toBe(secondPayment.razorpayOrderId);
    expect(orderRepo.payments.size).toBe(1);
  });

  it('creates a zero-trust checkout intent with a 5 minute Redis reservation and backend pricing', async () => {
    const orderRepo = new FakeOrderRepository();
    currentOrderRepo = orderRepo;
    const eventRepo = new FakeEventRepository({
      'evt-paid': buildEvent({ id: 'evt-paid', price: 500 }),
    });
    const service = new CheckoutService(orderRepo as any, eventRepo as any);

    const intent = await service.createCheckoutIntent({
      eventId: 'evt-paid',
      tierId: 'tier-1',
      quantity: 2,
      user: {
        id: 'user_1',
        name: 'Test User',
        email: 'test@example.com',
        phone: '+15555550123',
      },
      deviceId: 'device_1',
      workspaceId: 'ws_1',
      paymentGatewayConfig: {
        keyId: '',
        keySecret: '',
        allowMockPayment: true,
      },
    });

    expect(createReservation).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'evt-paid' }),
      'user_1',
      'device_1',
      [{ tierId: 'tier-1', quantity: 2 }],
      expect.objectContaining({
        reservationMinutes: 5,
        strictMode: true,
        checkoutSnapshot: expect.objectContaining({ version: 1, eventId: 'evt-paid' }),
      }),
    );
    expect(intent).toMatchObject({
      success: true,
      reservationId: 'res-mock',
      razorpayOrderId: expect.stringMatching(/^order_mock_/),
      amount: 1088.5,
      amountPaise: 108850,
      expiresAt: '2099-01-01',
    });
    expect(orderRepo.orders.size).toBe(1);
    expect(orderRepo.reservations.get('res-mock')).toMatchObject({
      status: 'converted',
      orderId: intent.orderId,
    });
    expect(commitInventory).toHaveBeenCalledTimes(1);
    expect(commitInventory).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        event: expect.objectContaining({ id: 'evt-paid' }),
        reservationId: 'res-mock',
        items: expect.arrayContaining([
          expect.objectContaining({ ticketId: 'tier-1', quantity: 2 }),
        ]),
      }),
    );
    expect([...orderRepo.orders.values()][0].tickets).toEqual([
      {
        ticketId: 'tier-1',
        name: 'General Admission',
        quantity: 2,
        price: 500,
        total: 1000,
      },
    ]);
    expect(orderRepo.payments.size).toBe(1);
  });

  it('rejects a canonical price race inside the order transaction before provider order creation', async () => {
    const orderRepo = new FakeOrderRepository();
    currentOrderRepo = orderRepo;
    const reservedEvent = buildEvent({ id: 'evt-drift', price: 500 });
    const changedEvent = {
      ...reservedEvent,
      tickets: reservedEvent.tickets.map((tier: any) => ({ ...tier, price: 600 })),
    };
    const eventRepo = new SequencedEventRepository([
      reservedEvent,
      reservedEvent,
      reservedEvent,
      changedEvent,
    ]);
    const service = new CheckoutService(orderRepo as any, eventRepo as any);

    await expect(
      service.createCheckoutIntent({
        eventId: 'evt-drift',
        tierId: 'tier-1',
        quantity: 1,
        user: { id: 'user_1', email: 'test@example.com' },
        workspaceId: 'ws_1',
        paymentGatewayConfig: { allowMockPayment: true },
      }),
    ).rejects.toMatchObject({ code: 'STALE_CART', statusCode: 409 });

    expect(commitInventory).not.toHaveBeenCalled();
    expect(orderRepo.payments.size).toBe(0);
    expect(releaseReservation).toHaveBeenCalledWith('res-mock');
  });

  it('rejects a reservation owned by another user before pricing or inventory mutation', async () => {
    const orderRepo = new FakeOrderRepository();
    currentOrderRepo = orderRepo;
    const event = buildEvent({ id: 'evt-owner', price: 500 });
    orderRepo.reservations.set(
      'res-owner',
      buildReservation({ id: 'res-owner', eventId: event.id, event }),
    );
    const service = new CheckoutService(
      orderRepo as any,
      new FakeEventRepository({ [event.id]: event }) as any,
    );

    await expect(
      service.initiateCheckout({
        reservationId: 'res-owner',
        userId: 'user_2',
        userName: 'Wrong User',
        userEmail: 'wrong@example.com',
        userPhone: '+15555550002',
      }),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
    expect(commitInventory).not.toHaveBeenCalled();
  });

  it('fails closed for a legacy reservation without a canonical checkout snapshot', async () => {
    const orderRepo = new FakeOrderRepository();
    currentOrderRepo = orderRepo;
    const event = buildEvent({ id: 'evt-legacy', price: 500 });
    const reservation = buildReservation({ id: 'res-legacy', eventId: event.id, event });
    delete reservation.checkoutSnapshot;
    orderRepo.reservations.set(reservation.id, reservation);
    const service = new CheckoutService(
      orderRepo as any,
      new FakeEventRepository({ [event.id]: event }) as any,
    );

    await expect(
      service.initiateCheckout({
        reservationId: reservation.id,
        userId: 'user_1',
        userName: 'Test User',
        userEmail: 'test@example.com',
        userPhone: '+15555550123',
      }),
    ).rejects.toMatchObject({ code: 'STALE_CART' });
    expect(commitInventory).not.toHaveBeenCalled();
    expect(releaseReservation).toHaveBeenCalledWith(reservation.id);
  });

  it('returns the existing confirmed order after a free reservation is converted', async () => {
    const orderRepo = new FakeOrderRepository();
    currentOrderRepo = orderRepo;
    const event = buildEvent({ id: 'evt-free', price: 0 });
    const eventRepo = new FakeEventRepository({
      'evt-free': event,
    });
    orderRepo.reservations.set(
      'res-free',
      buildReservation({ id: 'res-free', eventId: 'evt-free', event }),
    );
    const service = new CheckoutService(orderRepo as any, eventRepo as any);

    const firstResult = await service.initiateCheckout({
      reservationId: 'res-free',
      userId: 'user_1',
      userName: 'Test User',
      userEmail: 'test@example.com',
      userPhone: '+15555550123',
    });

    const secondResult = await service.initiateCheckout({
      reservationId: 'res-free',
      userId: 'user_1',
      userName: 'Test User',
      userEmail: 'test@example.com',
      userPhone: '+15555550123',
    });

    expect(firstResult.success).toBe(true);
    expect(firstResult.requiresPayment).toBe(false);
    expect(orderRepo.reservations.get('res-free')?.status).toBe('converted');
    expect(secondResult.success).toBe(true);
    expect(secondResult.requiresPayment).toBe(false);
    expect(secondResult.order.id).toBe(firstResult.order.id);
    expect(orderRepo.orders.size).toBe(1);
  });

  it('blocks duplicate RSVP purchases for the same user identity', async () => {
    const orderRepo = new FakeOrderRepository();
    currentOrderRepo = orderRepo;
    const event = buildEvent({ id: 'evt-rsvp', isRSVP: true });
    const eventRepo = new FakeEventRepository({
      'evt-rsvp': event,
    });
    orderRepo.reservations.set(
      'res-rsvp',
      buildReservation({ id: 'res-rsvp', eventId: 'evt-rsvp', event }),
    );
    orderRepo.rsvpOrders.set('RSVP-existing', {
      id: 'RSVP-existing',
      eventId: 'evt-rsvp',
      reservationId: 'old-reservation',
      userId: 'user_1',
      userEmail: 'test@example.com',
      status: 'confirmed',
      isRSVP: true,
      tickets: [{ quantity: 1 }],
    });
    const service = new CheckoutService(orderRepo as any, eventRepo as any);

    await expect(
      service.initiateCheckout({
        reservationId: 'res-rsvp',
        userId: 'user_1',
        userName: 'Test User',
        userEmail: 'test@example.com',
        userPhone: '+15555550123',
      }),
    ).rejects.toThrow('Already registered. One RSVP per person.');
  });

  it('rejects reservations for non-public lifecycle events before inventory work runs', async () => {
    const orderRepo = new FakeOrderRepository();
    currentOrderRepo = orderRepo;
    const eventRepo = new FakeEventRepository({
      'evt-paused': buildEvent({ id: 'evt-paused', lifecycle: 'paused' }),
    });
    const service = new CheckoutService(orderRepo as any, eventRepo as any);

    await expect(
      service.reserveItems({
        eventId: 'evt-paused',
        userId: 'user_1',
        deviceId: 'device_1',
        items: [{ tierId: 'tier-1', quantity: 1 }],
        workspaceId: 'ws_1',
      }),
    ).rejects.toThrow('Ticket sales for this event are temporarily paused.');
  });

  it('rejects reservations and checkout initiation after an event has ended', async () => {
    const orderRepo = new FakeOrderRepository();
    currentOrderRepo = orderRepo;
    const pastEvent = {
      ...buildEvent({ id: 'evt-ended' }),
      startDate: new Date(Date.now() - 60_000).toISOString(),
    };
    const eventRepo = new FakeEventRepository({ 'evt-ended': pastEvent });
    const service = new CheckoutService(orderRepo as any, eventRepo as any);

    await expect(
      service.reserveItems({
        eventId: 'evt-ended',
        userId: 'user_1',
        deviceId: 'device_1',
        items: [{ tierId: 'tier-1', quantity: 1 }],
        workspaceId: 'ws_1',
      }),
    ).rejects.toMatchObject({ code: 'EVENT_NOT_PURCHASABLE' });

    orderRepo.reservations.set(
      'res-ended',
      buildReservation({ id: 'res-ended', eventId: 'evt-ended', event: pastEvent }),
    );
    await expect(
      service.initiateCheckout({
        reservationId: 'res-ended',
        userId: 'user_1',
        userName: 'Test User',
        userEmail: 'test@example.com',
        userPhone: '+15555550123',
      }),
    ).rejects.toMatchObject({ code: 'EVENT_NOT_PURCHASABLE' });
  });

  it('validates preview pricing from the authoritative event instead of client prices', async () => {
    const orderRepo = new FakeOrderRepository();
    const eventRepo = new FakeEventRepository({
      'evt-preview': buildEvent({ id: 'evt-preview', price: 500 }),
    });
    const service = new CheckoutService(orderRepo as any, eventRepo as any);

    const result = await service.validatePricing({
      eventId: 'evt-preview',
      items: [{ tierId: 'tier-1', quantity: 2, price: 1 }],
    });

    expect(result.success).toBe(true);
    expect(result.pricing.items).toEqual([
      expect.objectContaining({ tierId: 'tier-1', quantity: 2, unitPrice: 500 }),
    ]);
  });

  it('computes cancellation policy using event timing and policy snapshot rules', async () => {
    const service = new CheckoutService(
      new FakeOrderRepository() as any,
      new FakeEventRepository({}) as any,
    );
    const order = {
      id: 'ord-cancel',
      status: 'confirmed',
      totalAmount: 2000,
      createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      cancellationPolicySnapshot: {
        policy: 'partial',
        refundPercent: 40,
      },
    };
    const event = {
      id: 'evt-cancel',
      title: 'After Dark',
      startDate: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
    };

    const decision = await service.getCancellationDecision(order, event);

    expect(decision.canCancel).toBe(true);
    expect(decision.refundPercentage).toBe(100);
    expect(decision.refundAmount).toBe(2000);
  });

  it('cancels an order through the shared service and returns the refund summary', async () => {
    const orderRepo = new FakeOrderRepository();
    currentOrderRepo = orderRepo;
    const service = new CheckoutService(orderRepo as any, new FakeEventRepository({}) as any);
    const order = {
      id: 'ord-cancel',
      reservationId: 'res-cancel',
      eventId: 'evt-cancel',
      userId: 'user_1',
      status: 'confirmed',
      totalAmount: 1499,
      isRSVP: false,
      paymentId: 'pay_1',
      createdAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    };
    const reservation = buildReservation({ id: 'res-cancel', eventId: 'evt-cancel' });
    const event = {
      id: 'evt-cancel',
      title: 'After Dark',
      startDate: new Date(Date.now() + 96 * 60 * 60 * 1000).toISOString(),
    };

    orderRepo.orders.set(order.id, order);
    orderRepo.reservations.set(reservation.id, reservation);

    const result = await service.cancelOrder(
      {
        order,
        event,
        reason: 'Can no longer attend',
        cancelledBy: 'user_1',
        cancelledByType: 'guest',
      },
      {
        refundPayment: async () => ({ id: 'refund_1', status: 'processing' }),
      },
    );

    expect(result.success).toBe(true);
    expect(result.orderId).toBe('ord-cancel');
    expect(result.refund).toMatchObject({
      percentage: 100,
      amount: 1499,
      status: 'processing',
      razorpayRefundId: 'refund_1',
    });
    expect(orderRepo.orders.get('ord-cancel')?.status).toBe('cancelled');
    expect(orderRepo.reservations.get('res-cancel')?.status).toBe('released');
  });

  it('restores inventory through the order engine when cancelling an unpaid order', async () => {
    const orderRepo = new FakeOrderRepository();
    currentOrderRepo = orderRepo;
    const service = new CheckoutService(orderRepo as any, new FakeEventRepository({}) as any);
    const order = {
      id: 'ord-pending',
      reservationId: 'res-pending',
      eventId: 'evt-pending',
      userId: 'user_1',
      status: 'payment_pending',
      totalAmount: 1499,
      isRSVP: false,
    };
    orderRepo.reservations.set(
      'res-pending',
      buildReservation({ id: 'res-pending', eventId: 'evt-pending' }),
    );
    orderRepo.payments.set('ord-pending__order_pending', {
      orderId: 'ord-pending',
      razorpayOrderId: 'order_pending',
      status: 'initiated',
      amount: 1499,
      userId: 'user_1',
      createdAt: new Date().toISOString(),
    });

    const result = await service.cancelOrder({
      order,
      event: { id: 'evt-pending' },
      cancelledBy: 'user_1',
      cancelledByType: 'user',
    });

    expect(cancelPendingCheckoutOrder).toHaveBeenCalledWith('ord-pending');
    expect(result).toMatchObject({ success: true, status: 'cancelled' });
    expect(orderRepo.reservations.get('res-pending')?.status).toBe('released');
    expect(orderRepo.payments.get('ord-pending__order_pending')).toMatchObject({
      status: 'failed',
      failedAt: expect.any(String),
    });
  });

  it('treats retrying cleanup for an already-cancelled order as success', async () => {
    const orderRepo = new FakeOrderRepository();
    currentOrderRepo = orderRepo;
    const service = new CheckoutService(orderRepo as any, new FakeEventRepository({}) as any);
    const order = {
      id: 'ord-already-cancelled',
      reservationId: 'res-already-released',
      eventId: 'evt-cancelled',
      userId: 'user_1',
      status: 'cancelled',
      totalAmount: 1499,
      isRSVP: false,
    };
    orderRepo.reservations.set(
      order.reservationId,
      buildReservation({ id: order.reservationId, eventId: order.eventId, status: 'released' }),
    );
    orderRepo.payments.set(`${order.id}__order_cancelled`, {
      orderId: order.id,
      razorpayOrderId: 'order_cancelled',
      status: 'initiated',
      amount: 1499,
      userId: 'user_1',
      createdAt: new Date().toISOString(),
    });

    const result = await service.cancelOrder({
      order,
      event: { id: order.eventId },
      cancelledBy: 'user_1',
      cancelledByType: 'user',
    });

    expect(result).toMatchObject({
      success: true,
      status: 'cancelled',
      alreadyCancelled: true,
    });
    expect(cancelPendingCheckoutOrder).not.toHaveBeenCalledWith(order.id);
    expect(orderRepo.reservations.get(order.reservationId)?.status).toBe('released');
    expect(orderRepo.payments.get(`${order.id}__order_cancelled`)).toMatchObject({
      status: 'failed',
      failedAt: expect.any(String),
    });
  });
});
