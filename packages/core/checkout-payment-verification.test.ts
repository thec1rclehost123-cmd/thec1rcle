import { describe, expect, it, vi } from 'vitest';
import { CheckoutService } from './src/domain/services/checkout-service.js';

class FakeOrderRepository {
  orders = new Map<string, any>();
  reservations = new Map<string, any>();
  payments = new Map<string, any>();

  async getOrderById(id: string) {
    return this.orders.get(id) || null;
  }

  async getOrderByReservationId() {
    return null;
  }

  async createOrder() {}

  async updateOrder(id: string, updates: any) {
    const order = this.orders.get(id);
    if (!order) throw new Error('Order not found');
    this.orders.set(id, { ...order, ...updates });
  }

  async checkExistingRSVP() {
    return false;
  }

  async getUserTicketCountForEvent() {
    return 0;
  }

  async checkExistingFreeTicketClaim() {
    return false;
  }

  async createFreeTicketClaim() {}

  async getReservationById(id: string) {
    return this.reservations.get(id) || null;
  }

  async createReservation() {}

  async updateReservation() {}

  async createPaymentRecord(payment: any) {
    this.payments.set(`${payment.orderId}__${payment.razorpayOrderId}`, payment);
  }

  async updatePaymentRecord(orderId: string, razorpayOrderId: string, updates: any) {
    const key = `${orderId}__${razorpayOrderId}`;
    const payment = this.payments.get(key);
    if (!payment) throw new Error('Payment record not found');
    this.payments.set(key, { ...payment, ...updates });
  }

  async getPaymentRecord(orderId: string, razorpayOrderId: string) {
    return this.payments.get(`${orderId}__${razorpayOrderId}`) || null;
  }

  async getLatestPendingPaymentRecord() {
    return null;
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
  async getById() {
    return null;
  }
}

function buildOrder(overrides: Record<string, any> = {}) {
  return {
    id: 'ord_1',
    eventId: 'evt_1',
    eventName: 'After Dark',
    workspaceId: 'ws_1',
    queueId: 'queue_1',
    userId: 'user_1',
    userName: 'Test User',
    userEmail: 'test@example.com',
    userPhone: '+15555550123',
    tickets: [{ ticketId: 'tier_1', name: 'GA', quantity: 1, price: 1499, total: 1499 }],
    subtotal: 1499,
    discounts: [],
    discountTotal: 0,
    fees: [],
    totalAmount: 1499,
    status: 'payment_pending',
    reservationId: 'res_1',
    promoterCode: null,
    createdAt: new Date().toISOString(),
    isRSVP: false,
    ...overrides,
  };
}

describe('CheckoutService payment verification', () => {
  it('confirms the order once and returns alreadyConfirmed on duplicate verification', async () => {
    const orderRepo = new FakeOrderRepository();
    const eventRepo = new FakeEventRepository();
    const service = new CheckoutService(orderRepo as any, eventRepo as any);
    const fulfillmentSpy = vi.fn(async () => undefined);
    (service as any).fulfillment.processFulfillment = fulfillmentSpy;

    orderRepo.orders.set('ord_1', buildOrder());
    orderRepo.payments.set('ord_1__order_rzp_1', {
      orderId: 'ord_1',
      razorpayOrderId: 'order_rzp_1',
      amount: 1499,
      status: 'initiated',
      userId: 'user_1',
      createdAt: new Date().toISOString(),
    });

    const first = await service.verifyPayment({
      orderId: 'ord_1',
      razorpayOrderId: 'order_rzp_1',
      razorpayPaymentId: 'pay_1',
      userId: 'user_1',
    });

    const second = await service.verifyPayment({
      orderId: 'ord_1',
      razorpayOrderId: 'order_rzp_1',
      razorpayPaymentId: 'pay_1',
      userId: 'user_1',
    });

    expect(first.success).toBe(true);
    expect(first.alreadyConfirmed).toBe(false);
    expect(second.success).toBe(true);
    expect(second.alreadyConfirmed).toBe(true);
    expect(orderRepo.orders.get('ord_1').status).toBe('confirmed');
    expect(orderRepo.payments.get('ord_1__order_rzp_1')).toMatchObject({
      status: 'verified',
      razorpayPaymentId: 'pay_1',
    });
    expect(fulfillmentSpy).toHaveBeenCalledTimes(1);
  });

  it('rejects a payment id that is already linked to another order', async () => {
    const orderRepo = new FakeOrderRepository();
    const eventRepo = new FakeEventRepository();
    const service = new CheckoutService(orderRepo as any, eventRepo as any);

    orderRepo.orders.set('ord_1', buildOrder());
    orderRepo.payments.set('ord_1__order_rzp_1', {
      orderId: 'ord_1',
      razorpayOrderId: 'order_rzp_1',
      amount: 1499,
      status: 'initiated',
      userId: 'user_1',
      createdAt: new Date().toISOString(),
    });
    orderRepo.payments.set('ord_other__order_rzp_other', {
      orderId: 'ord_other',
      razorpayOrderId: 'order_rzp_other',
      amount: 1499,
      status: 'verified',
      userId: 'user_2',
      createdAt: new Date().toISOString(),
      razorpayPaymentId: 'pay_dup',
      verifiedAt: new Date().toISOString(),
    });

    await expect(
      service.verifyPayment({
        orderId: 'ord_1',
        razorpayOrderId: 'order_rzp_1',
        razorpayPaymentId: 'pay_dup',
        userId: 'user_1',
      }),
    ).rejects.toThrow('Payment already linked to another order');
  });
});
