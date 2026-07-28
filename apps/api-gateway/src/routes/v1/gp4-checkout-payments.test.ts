import Fastify from 'fastify';
import crypto from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
process.env.RAZORPAY_KEY_SECRET = 'rzp_test_secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'rzp_webhook_secret';

vi.mock('@c1rcle/core/staff-engine', () => ({
  hasStaffPermission: vi.fn(async () => false),
}));

vi.mock('@c1rcle/core/promo-service', () => ({
  validatePromoCode: vi.fn(async () => ({
    valid: true,
    discountAmount: 250,
    message: '25% off applied!',
  })),
}));

vi.mock('@c1rcle/core/inventory-engine', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    releaseReservation: vi.fn(async () => ({ success: true })),
  };
});

vi.mock('@c1rcle/core/workflows/ticketing', () => ({
  verifyCheckoutPayment: vi.fn(async () => ({
    success: true,
    alreadyVerified: false,
    order: { id: 'ord_1', status: 'confirmed' },
    tickets: [{ id: 'TKT-ORD-1', ticketId: 'ord_1-tier_1-1', qrMode: 'jwt' }],
    ticketsCount: 1,
    razorpayOrderId: 'order_rzp_1',
    razorpayPaymentId: 'pay_1',
    chatUnlocked: true,
    chat: { id: 'chat_event_1', memberId: 'user_1' },
    redisReleased: true,
  })),
  finalizeTicketPayment: vi.fn(async () => ({
    success: true,
    orderId: 'ord_1',
    paymentId: 'pay_1',
    status: 'confirmed',
    alreadyFinalized: false,
    order: { id: 'ord_1', eventId: 'event_1', status: 'confirmed' },
    ticketIds: ['TKT-ORD-1'],
    entitlementIds: ['ENT-ORD-1'],
    ledgerMarkerId: 'ord_1',
    outboxEventId: 'ticket-purchase-ord_1',
  })),
}));

import validatePlugin from '../../plugins/validate';
import checkoutRoutes from './checkout';
import paymentRoutes from './payments';
import orderRoutes from './orders';
import { validatePromoCode } from '@c1rcle/core/promo-service';
// @ts-ignore
import { finalizeTicketPayment, verifyCheckoutPayment } from '@c1rcle/core/workflows/ticketing';

function buildDbMock(
  eventTickets: any[] = [
    {
      id: 'tier_1',
      name: 'General Admission',
      price: 999,
      quantity: 100,
      remaining: 80,
    },
  ],
) {
  return {
    runTransaction: vi.fn(async (callback: any) =>
      callback({
        get: vi.fn(async (target: any) =>
          typeof target?.get === 'function'
            ? target.get()
            : { exists: false, docs: [], empty: true, size: 0 },
        ),
        update: vi.fn(),
        set: vi.fn(),
        create: vi.fn(),
      }),
    ),
    collection: vi.fn((name: string) => {
      if (name === 'events') {
        return {
          doc: vi.fn((id: string) => ({
            get: vi.fn(async () => ({
              exists: true,
              id,
              data: () => ({
                title: 'After Dark',
                venueId: 'venue_1',
                startDate: '2099-01-01T20:00:00.000Z',
                tickets: eventTickets,
              }),
            })),
          })),
        };
      }

      if (name === 'cart_reservations') {
        return {
          doc: vi.fn((id: string) => ({
            get: vi.fn(async () => ({
              exists: true,
              id,
              data: () => ({
                eventId: 'event_1',
                customerId: 'user_1',
                status: 'active',
                expiresAt: '2099-01-01T21:00:00.000Z',
                items: [{ tierId: 'tier_1', quantity: 2 }],
              }),
            })),
          })),
        };
      }

      return {
        where: vi.fn(() => ({
          where: vi.fn(() => ({
            limit: vi.fn(() => ({
              get: vi.fn(async () => ({ docs: [], empty: true, size: 0 })),
            })),
          })),
          limit: vi.fn(() => ({
            get: vi.fn(async () => ({ docs: [], empty: true, size: 0 })),
          })),
          get: vi.fn(async () => ({ docs: [], empty: true, size: 0 })),
        })),
        doc: vi.fn(() => ({
          get: vi.fn(async () => ({ exists: false, data: () => null })),
        })),
      };
    }),
  };
}

async function buildServer(eventTickets?: any[]) {
  const server = Fastify({ logger: false });
  const checkoutService = {
    reserveItems: vi.fn(
      async ({ eventId, items, userId, deviceId, options, workspaceId }: any) => ({
        reservationId: 'res_1',
        eventId,
        items,
        userId,
        deviceId,
        queueId: options?.queueId || null,
        workspaceId: workspaceId || null,
        status: 'active',
        expiresAt: '2099-01-01T21:00:00.000Z',
      }),
    ),
    validatePricing: vi.fn(async () => ({
      success: true,
      pricing: {
        items: [{ tierId: 'tier_1', quantity: 2, unitPrice: 999, subtotal: 1998 }],
      },
    })),
    initiateCheckout: vi.fn(async () => ({
      success: true,
      requiresPayment: true,
      order: { id: 'ord_1', eventId: 'event_1', workspaceId: 'ws_1', totalAmount: 1499 },
      pricing: { grandTotal: 1499 },
    })),
    createCheckoutIntent: vi.fn(async () => ({
      success: true,
      orderId: 'ord_1',
      reservationId: 'res_1',
      razorpayOrderId: 'order_rzp_1',
      amount: 1499,
      amountPaise: 149900,
      currency: 'INR',
      key: 'rzp_test_key',
      expiresAt: '2099-01-01T21:00:00.000Z',
    })),
    preparePayment: vi.fn(async () => ({
      razorpayOrderId: 'order_rzp_1',
      amount: 1499,
      currency: 'INR',
      key: 'rzp_test_key',
    })),
    verifyPayment: vi.fn(async () => ({
      success: true,
      alreadyConfirmed: false,
      order: { id: 'ord_1', status: 'confirmed' },
    })),
    getCancellationDecision: vi.fn(async () => ({
      canCancel: true,
      reason: null,
      refundPercentage: 100,
      refundAmount: 1499,
      orderTotal: 1499,
      eventTitle: 'After Dark',
      freeCancellationWindow: '24h from purchase',
    })),
    cancelOrder: vi.fn(async () => ({
      success: true,
      orderId: 'ord_1',
      status: 'cancelled',
      refund: {
        percentage: 100,
        amount: 1499,
        status: 'processing',
        razorpayRefundId: 'refund_1',
        estimatedDays: '5-7 business days',
      },
      message: 'Order cancelled. A full refund has been initiated.',
    })),
    cancelCheckout: vi.fn(async () => ({ success: true })),
    recordPaymentFailure: vi.fn(async () => undefined),
  };
  const orderRepo = {
    getOrderById: vi.fn(async (id: string) => ({
      id,
      userId: 'user_1',
      eventId: 'event_1',
      status: 'payment_pending',
      totalAmount: 1499,
      queueId: null,
      isRSVP: false,
    })),
    getReservationById: vi.fn(async () => null),
    updateOrder: vi.fn(async () => undefined),
  };

  server.decorate('db', buildDbMock(eventTickets) as any);
  server.decorate('cache', {
    get: vi.fn(async () => null),
    set: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
  } as any);
  server.decorate('requireAuth', async (request: any, reply: any) => {
    if (request.user?.uid) return;
    return reply.status(401).send({ success: false, error: 'Unauthorized' });
  });
  server.decorate('requireRoles', vi.fn(() => async () => undefined) as any);
  server.decorate('checkoutService', checkoutService as any);
  server.decorate('orderRepo', orderRepo as any);
  server.decorate('writeAuditLog', vi.fn(async () => undefined) as any);
  server.addHook('onRequest', async (request: any) => {
    if (request.headers.authorization) {
      request.user = {
        uid: 'user_1',
        email: 'guest@example.com',
        displayName: 'Guest User',
        phoneNumber: '+919999999999',
      };
    }
    request.workspaceId = null;
  });

  await server.register(validatePlugin);
  await server.register(checkoutRoutes, { prefix: '/api/v1' });
  await server.register(paymentRoutes, { prefix: '/api/v1' });
  await server.register(orderRoutes, { prefix: '/api/v1/orders' });

  return { server, checkoutService, orderRepo };
}

describe('GP-4 gateway checkout/payment routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = 'test';
    process.env.VERCEL_ENV = '';
    process.env.C1RCLE_ALLOW_MOCK_RAZORPAY = '';
    process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
    process.env.RAZORPAY_KEY_SECRET = 'rzp_test_secret';
    process.env.RAZORPAY_WEBHOOK_SECRET = 'rzp_webhook_secret';
  });

  it('POST /api/v1/checkout/verify delegates Razorpay verification and ticketing to core', async () => {
    const { server } = await buildServer();

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/checkout/verify',
      headers: { authorization: 'Bearer test-token' },
      payload: {
        razorpay_order_id: 'order_rzp_1',
        razorpay_payment_id: 'pay_1',
        razorpay_signature: 'sig_1',
      },
    });

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toMatchObject({
      success: true,
      alreadyVerified: false,
      ticketsCount: 1,
      chatUnlocked: true,
      redisReleased: true,
    });
    expect(verifyCheckoutPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        db: expect.any(Object),
        userId: 'user_1',
        razorpay_order_id: 'order_rzp_1',
        razorpay_payment_id: 'pay_1',
        razorpay_signature: 'sig_1',
        paymentGatewayConfig: {
          keySecret: 'rzp_test_secret',
          allowMockPayment: false,
        },
      }),
    );

    await server.close();
  });

  it('POST /api/v1/checkout/verify rejects client-supplied internal order ids', async () => {
    const { server } = await buildServer();

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/checkout/verify',
      headers: { authorization: 'Bearer test-token' },
      payload: {
        orderId: 'ord_1',
        razorpay_order_id: 'order_rzp_1',
        razorpay_payment_id: 'pay_1',
        razorpay_signature: 'sig_1',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
    expect(verifyCheckoutPayment).not.toHaveBeenCalled();

    await server.close();
  });

  it('POST /api/v1/checkout/verify maps invalid signatures to 400', async () => {
    const { server } = await buildServer();
    vi.mocked(verifyCheckoutPayment).mockRejectedValueOnce(
      Object.assign(new Error('Invalid signature'), { code: 'PAYMENT_SIGNATURE_INVALID' }),
    );

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/checkout/verify',
      headers: { authorization: 'Bearer test-token' },
      payload: {
        razorpay_order_id: 'order_rzp_1',
        razorpay_payment_id: 'pay_1',
        razorpay_signature: 'bad_sig',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ success: false, error: 'Invalid signature' });

    await server.close();
  });

  it('POST /api/v1/checkout/intent creates a zero-trust Razorpay intent from tier selection only', async () => {
    const { server, checkoutService } = await buildServer();

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/checkout/intent',
      headers: { authorization: 'Bearer token', 'user-agent': 'expo-test' },
      payload: {
        eventId: 'event_1',
        tierId: 'tier_1',
        quantity: 2,
      },
    });

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toMatchObject({
      success: true,
      razorpayOrderId: 'order_rzp_1',
      amount: 1499,
      amountPaise: 149900,
      expiresAt: '2099-01-01T21:00:00.000Z',
      orderId: 'ord_1',
      reservationId: 'res_1',
    });
    expect(checkoutService.createCheckoutIntent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventId: 'event_1',
        tierId: 'tier_1',
        quantity: 2,
        deviceId: 'expo-test',
        user: {
          id: 'user_1',
          name: 'Guest User',
          email: 'guest@example.com',
          phone: '+919999999999',
        },
        paymentGatewayConfig: {
          keyId: 'rzp_test_key',
          keySecret: 'rzp_test_secret',
          allowMockPayment: false,
          forceMockPayment: false,
        },
      }),
    );

    await server.close();
  });

  it('POST /api/v1/checkout/intent rejects client-supplied price fields', async () => {
    const { server, checkoutService } = await buildServer();

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/checkout/intent',
      headers: { authorization: 'Bearer token' },
      payload: {
        eventId: 'event_1',
        tierId: 'tier_1',
        quantity: 2,
        price: 1,
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
    expect(checkoutService.createCheckoutIntent).not.toHaveBeenCalled();

    await server.close();
  });

  it('POST /api/v1/checkout/intent maps sold-out inventory to 409', async () => {
    const { server, checkoutService } = await buildServer();
    checkoutService.createCheckoutIntent.mockRejectedValueOnce(
      Object.assign(new Error('Sold Out'), { code: 'SOLD_OUT' }),
    );

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/checkout/intent',
      headers: { authorization: 'Bearer token' },
      payload: {
        eventId: 'event_1',
        tierId: 'tier_1',
        quantity: 2,
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ success: false, error: 'Sold Out' });

    await server.close();
  });

  it('POST /api/v1/checkout/initiate returns the legacy payment-initiation contract without requiring x-workspace-id', async () => {
    const { server, checkoutService } = await buildServer();

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/checkout/initiate',
      headers: { authorization: 'Bearer test-token' },
      payload: {
        reservationId: 'res_1',
        promoCode: 'NIGHT',
        hostUpdatesOptIn: true,
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      success: true,
      requiresPayment: true,
      order: { id: 'ord_1', totalAmount: 1499 },
      pricing: { grandTotal: 1499 },
      razorpay: { orderId: 'order_rzp_1', amount: 1499, currency: 'INR', key: 'rzp_test_key' },
    });
    expect(checkoutService.initiateCheckout).toHaveBeenCalledWith(
      expect.objectContaining({
        reservationId: 'res_1',
        promoCode: 'NIGHT',
        hostUpdatesOptIn: true,
        userId: 'user_1',
      }),
      null,
    );
    expect(checkoutService.preparePayment).toHaveBeenCalledWith(
      'ord_1',
      'user_1',
      expect.any(Object),
    );

    await server.close();
  });

  it('POST /api/v1/checkout/cancel authorizes the canonical reservation customerId', async () => {
    const { server } = await buildServer();

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/checkout/cancel',
      headers: { authorization: 'Bearer test-token' },
      payload: { reservationId: 'res_1' },
    });

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toEqual({
      success: true,
      message: 'Reservation released',
    });

    await server.close();
  });

  it('POST /api/v1/checkout/reserve forwards admissionToken-derived queueId to the shared checkout service', async () => {
    const { server, checkoutService } = await buildServer();

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/checkout/reserve',
      headers: { authorization: 'Bearer test-token' },
      payload: {
        eventId: 'event_1',
        items: [{ tierId: 'tier_1', quantity: 2 }],
        deviceId: 'browser-user_1',
        admissionToken: 'event_1:user_1:queue_123:signature',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      reservationId: 'res_1',
      eventId: 'event_1',
      queueId: 'queue_123',
      status: 'active',
    });
    expect(checkoutService.reserveItems).toHaveBeenCalledWith({
      eventId: 'event_1',
      userId: 'user_1',
      deviceId: 'browser-user_1',
      items: [{ tierId: 'tier_1', quantity: 2 }],
      workspaceId: null,
      options: { queueId: 'queue_123' },
    });

    await server.close();
  });

  it('POST /api/v1/checkout/calculate returns an authoritative quote with order and tier constraints', async () => {
    const { server } = await buildServer();

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/checkout/calculate',
      payload: {
        eventId: 'event_1',
        items: [{ tierId: 'tier_1', quantity: 2 }],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      success: true,
      pricing: expect.objectContaining({
        grandTotal: expect.any(Number),
        fees: expect.objectContaining({ total: expect.any(Number) }),
      }),
      quote: expect.objectContaining({
        constraints: expect.objectContaining({
          order: expect.objectContaining({
            minTickets: expect.any(Number),
            maxTickets: expect.any(Number),
            totalQuantity: 2,
          }),
          tiers: expect.any(Array),
        }),
        cta: expect.objectContaining({
          state: expect.any(String),
          requiresPayment: expect.any(Boolean),
        }),
      }),
    });

    await server.close();
  });

  it('POST /api/v1/checkout/calculate rejects an unfunded Cover Wallet before reservation or payment', async () => {
    const { server } = await buildServer([
      {
        id: 'tier_1',
        name: 'Underfunded Cover Package',
        price: 499,
        quantity: 100,
        remaining: 80,
        coverChargeConfig: {
          enabled: true,
          walletAmountPaise: 50_000,
        },
      },
    ]);

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/checkout/calculate',
      payload: {
        eventId: 'event_1',
        items: [{ tierId: 'tier_1', quantity: 1 }],
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      success: false,
      code: 'COVER_WALLET_UNFUNDED',
    });

    await server.close();
  });

  it('POST /api/v1/checkout/calculate accepts an empty selection and still returns authoritative tier constraints', async () => {
    const { server } = await buildServer();

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/checkout/calculate',
      payload: {
        eventId: 'event_1',
        items: [],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      success: true,
      pricing: expect.objectContaining({
        subtotal: 0,
        grandTotal: 0,
      }),
      quote: expect.objectContaining({
        constraints: expect.objectContaining({
          order: expect.objectContaining({
            totalQuantity: 0,
          }),
          tiers: [
            expect.objectContaining({
              tierId: 'tier_1',
              available: expect.any(Number),
              unitPrice: 999,
            }),
          ],
        }),
        cta: expect.objectContaining({
          state: 'empty',
          requiresPayment: false,
        }),
      }),
    });

    await server.close();
  });

  it('POST /api/v1/checkout/calculate returns a reservation snapshot when resuming a saved checkout', async () => {
    const { server } = await buildServer();

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/checkout/calculate',
      payload: {
        reservationId: 'res_saved_1',
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      success: true,
      reservation: {
        reservationId: 'res_saved_1',
        eventId: 'event_1',
        status: 'active',
        expiresAt: '2099-01-01T21:00:00.000Z',
        items: [{ tierId: 'tier_1', quantity: 2 }],
      },
      quote: expect.objectContaining({
        constraints: expect.objectContaining({
          order: expect.objectContaining({
            totalQuantity: 2,
          }),
        }),
      }),
    });

    await server.close();
  });

  it('POST /api/v1/checkout/promo derives authoritative pricing items server-side before validating the promo code', async () => {
    const { server, checkoutService } = await buildServer();

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/checkout/promo',
      headers: { authorization: 'Bearer test-token' },
      payload: {
        eventId: 'event_1',
        code: 'NIGHT',
        items: [{ tierId: 'tier_1', quantity: 2 }],
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      success: true,
      valid: true,
      discountAmount: 250,
    });
    expect(checkoutService.validatePricing).toHaveBeenCalledWith(
      {
        eventId: 'event_1',
        items: [{ tierId: 'tier_1', quantity: 2 }],
      },
      null,
    );
    expect(validatePromoCode).toHaveBeenCalledWith('event_1', 'NIGHT', 'user_1', [
      { tierId: 'tier_1', quantity: 2, unitPrice: 999, subtotal: 1998 },
    ]);

    await server.close();
  });

  it('PATCH /api/v1/payments/verify returns alreadyConfirmed for idempotent duplicate confirmation', async () => {
    const { server } = await buildServer();
    vi.mocked(finalizeTicketPayment).mockResolvedValueOnce({
      success: true,
      orderId: 'ord_1',
      paymentId: 'pay_1',
      status: 'confirmed',
      alreadyFinalized: true,
      order: { id: 'ord_1', eventId: 'event_1', status: 'confirmed' },
      ticketIds: ['TKT-ORD-1'],
      entitlementIds: ['ENT-ORD-1'],
      ledgerMarkerId: 'ord_1',
    } as any);
    const signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET as string)
      .update('order_rzp_1|pay_1')
      .digest('hex');

    const response = await server.inject({
      method: 'PATCH',
      url: '/api/v1/payments/verify',
      headers: { authorization: 'Bearer test-token' },
      payload: {
        orderId: 'ord_1',
        razorpay_order_id: 'order_rzp_1',
        razorpay_payment_id: 'pay_1',
        razorpay_signature: signature,
      },
    });

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json()).toMatchObject({
      success: true,
      alreadyConfirmed: true,
      message: 'Order already confirmed',
    });
    expect(finalizeTicketPayment).toHaveBeenCalledWith({
      db: expect.any(Object),
      expectedOrderId: 'ord_1',
      requestId: expect.any(String),
      razorpayOrderId: 'order_rzp_1',
      razorpayPaymentId: 'pay_1',
      razorpaySignature: signature,
      source: 'client',
      userId: 'user_1',
      paymentGatewayConfig: expect.any(Object),
    });
    await server.close();
  });

  it('PATCH /api/v1/payments/verify returns 409 when the shared checkout service rejects finalization', async () => {
    const { server } = await buildServer();
    vi.mocked(finalizeTicketPayment).mockRejectedValueOnce(
      Object.assign(new Error('Payment is not successful'), {
        code: 'ORDER_NOT_FINALIZABLE',
      }),
    );
    const signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET as string)
      .update('order_rzp_1|pay_1')
      .digest('hex');

    const response = await server.inject({
      method: 'PATCH',
      url: '/api/v1/payments/verify',
      headers: { authorization: 'Bearer test-token' },
      payload: {
        orderId: 'ord_1',
        razorpay_order_id: 'order_rzp_1',
        razorpay_payment_id: 'pay_1',
        razorpay_signature: signature,
      },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      success: false,
      error: expect.objectContaining({ message: 'Payment is not successful' }),
    });

    await server.close();
  });

  it('PATCH /api/v1/payments/verify rejects mock payment payloads in production', async () => {
    const { server } = await buildServer();
    process.env.NODE_ENV = 'production';
    vi.mocked(finalizeTicketPayment).mockRejectedValueOnce(
      Object.assign(new Error('Mock payments are disabled'), { code: 'BAD_REQUEST' }),
    );

    const response = await server.inject({
      method: 'PATCH',
      url: '/api/v1/payments/verify',
      headers: { authorization: 'Bearer test-token' },
      payload: {
        orderId: 'ord_1',
        razorpay_order_id: 'order_mock_1',
        razorpay_payment_id: 'pay_mock_1',
        razorpay_signature: 'sig_mock_1',
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: expect.objectContaining({ message: 'Mock payments are disabled' }),
    });
    expect(finalizeTicketPayment).toHaveBeenCalledOnce();

    await server.close();
  });

  it('PATCH /api/v1/payments/verify fails closed when Razorpay signing secret is missing', async () => {
    const { server } = await buildServer();
    delete process.env.RAZORPAY_KEY_SECRET;
    vi.mocked(finalizeTicketPayment).mockRejectedValueOnce(
      Object.assign(new Error('Payment verification is not configured'), {
        code: 'PAYMENT_NOT_CONFIGURED',
      }),
    );

    const response = await server.inject({
      method: 'PATCH',
      url: '/api/v1/payments/verify',
      headers: { authorization: 'Bearer test-token' },
      payload: {
        orderId: 'ord_1',
        razorpay_order_id: 'order_rzp_1',
        razorpay_payment_id: 'pay_1',
        razorpay_signature: 'not_checked_without_secret',
      },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({
      error: expect.objectContaining({ message: 'Payment verification is not configured' }),
    });
    expect(finalizeTicketPayment).toHaveBeenCalledOnce();

    await server.close();
  });

  it('POST /api/v1/payments/webhook verifies the signature and confirms the order via the gateway service', async () => {
    const { server, orderRepo } = await buildServer();
    const payload = JSON.stringify({
      event: 'payment.captured',
      payload: {
        payment: {
          entity: {
            id: 'pay_1',
            order_id: 'order_rzp_1',
            notes: { orderId: 'ord_1' },
          },
        },
      },
    });
    const signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET as string)
      .update(payload)
      .digest('hex');

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/payments/webhook',
      headers: {
        'content-type': 'text/plain',
        'x-razorpay-signature': signature,
      },
      payload,
    });

    expect(response.statusCode, response.body).toBe(200);
    expect(finalizeTicketPayment).toHaveBeenCalledWith({
      db: expect.any(Object),
      expectedOrderId: 'ord_1',
      requestId: expect.any(String),
      razorpayOrderId: 'order_rzp_1',
      razorpayPaymentId: 'pay_1',
      source: 'webhook',
      webhookVerified: true,
      providerPayment: expect.objectContaining({ id: 'pay_1' }),
      paymentGatewayConfig: expect.any(Object),
    });
    expect(orderRepo.getOrderById).not.toHaveBeenCalled();

    await server.close();
  });

  it('POST /api/v1/payments/webhook records failed attempts without rewriting the order state', async () => {
    const { server, checkoutService, orderRepo } = await buildServer();
    const payload = JSON.stringify({
      event: 'payment.failed',
      payload: {
        payment: {
          entity: {
            id: 'pay_2',
            order_id: 'order_rzp_1',
            notes: { orderId: 'ord_1' },
          },
        },
      },
    });
    const signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET as string)
      .update(payload)
      .digest('hex');

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/payments/webhook',
      headers: {
        'content-type': 'text/plain',
        'x-razorpay-signature': signature,
      },
      payload,
    });

    expect(response.statusCode).toBe(200);
    expect(checkoutService.recordPaymentFailure).toHaveBeenCalledWith(
      'ord_1',
      'order_rzp_1',
      'pay_2',
    );
    expect(orderRepo.updateOrder).not.toHaveBeenCalled();

    await server.close();
  });

  it('GET /api/v1/orders/:id enforces ownership and returns event-enriched detail', async () => {
    const { server } = await buildServer();

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/orders/ord_1',
      headers: { authorization: 'Bearer test-token' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      success: true,
      order: { id: 'ord_1', status: 'payment_pending' },
      event: { id: 'event_1', title: 'After Dark' },
    });

    await server.close();
  });

  it('GET /api/v1/orders/:id skips event enrichment when the caller only needs status polling', async () => {
    const { server } = await buildServer();

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/orders/ord_1?includeEvent=false',
      headers: { authorization: 'Bearer test-token' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      success: true,
      order: { id: 'ord_1', status: 'payment_pending' },
      event: null,
    });

    await server.close();
  });

  it('GET /api/v1/orders/:id/cancel delegates cancellation policy to the shared checkout service', async () => {
    const { server, checkoutService } = await buildServer();

    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/orders/ord_1/cancel',
      headers: { authorization: 'Bearer test-token' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      canCancel: true,
      refundPercentage: 100,
      refundAmount: 1499,
    });
    expect(checkoutService.getCancellationDecision).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'ord_1' }),
      expect.objectContaining({ id: 'event_1', title: 'After Dark' }),
    );

    await server.close();
  });

  it('POST /api/v1/orders/:id/cancel delegates cancellation execution to the shared checkout service', async () => {
    const { server, checkoutService } = await buildServer();

    const response = await server.inject({
      method: 'POST',
      url: '/api/v1/orders/ord_1/cancel',
      headers: { authorization: 'Bearer test-token' },
      payload: { reason: 'Can no longer attend' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      success: true,
      orderId: 'ord_1',
      status: 'cancelled',
      refund: {
        percentage: 100,
        amount: 1499,
      },
    });
    expect(checkoutService.cancelOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        order: expect.objectContaining({ id: 'ord_1' }),
        event: expect.objectContaining({ id: 'event_1' }),
        reason: 'Can no longer attend',
        cancelledBy: 'user_1',
        cancelledByType: 'guest',
      }),
      expect.objectContaining({
        refundPayment: expect.any(Function),
      }),
    );

    await server.close();
  });
});
