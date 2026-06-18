import { describe, expect, it, beforeEach, afterAll, vi } from 'vitest';
import { CheckoutService } from './src/domain/services/checkout-service.js';
import { createReservation } from './inventory-engine.js';

vi.mock('./admin.js', () => ({
  getAdminDb: vi.fn(() => ({
    runTransaction: vi.fn(async (cb) =>
      cb({
        get: vi.fn(async () => ({ exists: false, data: () => ({}) })),
        set: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
        collection: vi.fn(() => ({
          doc: vi.fn(() => ({
            get: vi.fn(),
            set: vi.fn(),
          })),
        })),
      }),
    ),
    collection: vi.fn((col) => ({
      doc: vi.fn((id) => ({
        update: vi.fn(),
        get: vi.fn(),
        set: vi.fn(),
      })),
    })),
  })),
  getAdminApp: vi.fn(),
  isFirebaseConfigured: () => false,
}));

export let currentOrderRepo: any = null;

vi.mock('./order-engine.js', async (importOriginal) => {
  const mod = await importOriginal<any>();
  return {
    ...mod,
    executeOrderCreation: vi.fn(async (transaction, { db, event, orderData, reservationId }) => {
      const status =
        orderData.totalAmount === 0 || orderData.isRSVP ? 'confirmed' : 'payment_pending';
      const finalOrder = { ...orderData, status, updatedAt: new Date().toISOString() };
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
    }),
  };
});

vi.mock('./inventory-engine.js', () => ({
  releaseReservation: vi.fn().mockResolvedValue({ success: true }),
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
    startDate: '2026-05-01T20:00:00.000Z',
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
}: {
  id: string;
  eventId: string;
  status?: string;
}) {
  return {
    id,
    eventId,
    workspaceId: 'ws_1',
    customerId: 'user_1',
    queueId: 'queue_1',
    status,
    items: [
      {
        tierId: 'tier-1',
        tierName: 'General Admission',
        entryType: 'general',
        quantity: 1,
      },
    ],
    createdAt: new Date().toISOString(),
    expiresAt: futureIso(),
  };
}

describe('CheckoutService parity', () => {
  it('reuses the same paid order for repeated calls on one reservation', async () => {
    const orderRepo = new FakeOrderRepository();
    currentOrderRepo = orderRepo;
    const eventRepo = new FakeEventRepository({
      'evt-paid': buildEvent({ id: 'evt-paid', price: 500 }),
    });
    orderRepo.reservations.set(
      'res-paid',
      buildReservation({ id: 'res-paid', eventId: 'evt-paid' }),
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
  });

  it('reuses the latest pending payment intent for the same order instead of creating a new one', async () => {
    const orderRepo = new FakeOrderRepository();
    currentOrderRepo = orderRepo;
    const eventRepo = new FakeEventRepository({
      'evt-paid': buildEvent({ id: 'evt-paid', price: 500 }),
    });
    orderRepo.reservations.set(
      'res-paid',
      buildReservation({ id: 'res-paid', eventId: 'evt-paid' }),
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
      { reservationMinutes: 5, strictMode: true },
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

  it('returns the existing confirmed order after a free reservation is converted', async () => {
    const orderRepo = new FakeOrderRepository();
    currentOrderRepo = orderRepo;
    const eventRepo = new FakeEventRepository({
      'evt-free': buildEvent({ id: 'evt-free', price: 0 }),
    });
    orderRepo.reservations.set(
      'res-free',
      buildReservation({ id: 'res-free', eventId: 'evt-free' }),
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
    const eventRepo = new FakeEventRepository({
      'evt-rsvp': buildEvent({ id: 'evt-rsvp', isRSVP: true }),
    });
    orderRepo.reservations.set(
      'res-rsvp',
      buildReservation({ id: 'res-rsvp', eventId: 'evt-rsvp' }),
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
});
