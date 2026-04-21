import Fastify from 'fastify';
import crypto from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
process.env.RAZORPAY_KEY_SECRET = 'rzp_test_secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'rzp_webhook_secret';

vi.mock('@c1rcle/core/staff-engine', () => ({
    hasStaffPermission: vi.fn(async () => false),
}));

import validatePlugin from '../../plugins/validate';
import checkoutRoutes from './checkout';
import paymentRoutes from './payments';
import orderRoutes from './orders';

function buildDbMock() {
    return {
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

async function buildServer() {
    const server = Fastify({ logger: false });
    const checkoutService = {
        initiateCheckout: vi.fn(async () => ({
            success: true,
            requiresPayment: true,
            order: { id: 'ord_1', eventId: 'event_1', workspaceId: 'ws_1', totalAmount: 1499 },
            pricing: { grandTotal: 1499 },
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
        cancelCheckout: vi.fn(async () => ({ success: true })),
    };
    const orderRepo = {
        getOrderById: vi.fn(async (id: string) => ({
            id,
            userId: 'user_1',
            eventId: 'event_1',
            status: 'payment_pending',
            totalAmount: 1499,
            isRSVP: false,
        })),
        getReservationById: vi.fn(async () => null),
        updateOrder: vi.fn(async () => undefined),
    };

    server.decorate('db', buildDbMock() as any);
    server.decorate('cache', {
        get: vi.fn(async () => null),
        set: vi.fn(async () => undefined),
        delete: vi.fn(async () => undefined),
    } as any);
    server.decorate('requireRoles', vi.fn(() => async () => undefined) as any);
    server.decorate('checkoutService', checkoutService as any);
    server.decorate('orderRepo', orderRepo as any);
    server.addHook('onRequest', async (request: any) => {
        if (request.headers.authorization) {
            request.user = { uid: 'user_1' };
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
            expect.objectContaining({ reservationId: 'res_1', promoCode: 'NIGHT', userId: 'user_1' }),
            null
        );
        expect(checkoutService.preparePayment).toHaveBeenCalledWith('ord_1', 'user_1', expect.any(Object));

        await server.close();
    });

    it('PATCH /api/v1/payments/verify returns alreadyConfirmed for idempotent duplicate confirmation', async () => {
        const { server, checkoutService } = await buildServer();
        checkoutService.verifyPayment.mockResolvedValueOnce({
            success: true,
            alreadyConfirmed: true,
            order: { id: 'ord_1', status: 'confirmed' },
        });
        const signature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET as string)
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

        expect(response.statusCode).toBe(200);
        expect(response.json()).toMatchObject({
            success: true,
            alreadyConfirmed: true,
            message: 'Order already confirmed',
        });
        await server.close();
    });

    it('POST /api/v1/payments/webhook verifies the signature and confirms the order via the gateway service', async () => {
        const { server, checkoutService, orderRepo } = await buildServer();
        const payload = JSON.stringify({
            event: 'payment.captured',
            payload: {
                payment: {
                    entity: {
                        id: 'pay_1',
                        order_id: 'order_rzp_1',
                        notes: { orderId: 'ord_1' },
                    }
                }
            }
        });
        const signature = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET as string)
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
        expect(orderRepo.getOrderById).toHaveBeenCalledWith('ord_1');
        expect(checkoutService.verifyPayment).toHaveBeenCalledWith({
            orderId: 'ord_1',
            razorpayOrderId: 'order_rzp_1',
            razorpayPaymentId: 'pay_1',
            userId: 'user_1',
        });

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
});
