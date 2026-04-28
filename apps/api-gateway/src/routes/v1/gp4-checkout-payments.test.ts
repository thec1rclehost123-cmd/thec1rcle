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

import validatePlugin from '../../plugins/validate';
import checkoutRoutes from './checkout';
import paymentRoutes from './payments';
import orderRoutes from './orders';
import { validatePromoCode } from '@c1rcle/core/promo-service';

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
                                tickets: [
                                    {
                                        id: 'tier_1',
                                        name: 'General Admission',
                                        price: 999,
                                        quantity: 100,
                                        remaining: 80,
                                    },
                                ],
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

async function buildServer() {
    const server = Fastify({ logger: false });
    const checkoutService = {
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
        process.env.NODE_ENV = 'test';
        process.env.VERCEL_ENV = '';
        process.env.C1RCLE_ALLOW_MOCK_RAZORPAY = '';
        process.env.RAZORPAY_KEY_ID = 'rzp_test_key';
        process.env.RAZORPAY_KEY_SECRET = 'rzp_test_secret';
        process.env.RAZORPAY_WEBHOOK_SECRET = 'rzp_webhook_secret';
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
        expect(checkoutService.validatePricing).toHaveBeenCalledWith({
            eventId: 'event_1',
            items: [{ tierId: 'tier_1', quantity: 2 }],
        }, null);
        expect(validatePromoCode).toHaveBeenCalledWith(
            'event_1',
            'NIGHT',
            'user_1',
            [{ tierId: 'tier_1', quantity: 2, unitPrice: 999, subtotal: 1998 }]
        );

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
        expect(checkoutService.verifyPayment).toHaveBeenCalledWith({
            orderId: 'ord_1',
            razorpayOrderId: 'order_rzp_1',
            razorpayPaymentId: 'pay_1',
            userId: 'user_1',
            paymentGatewayConfig: expect.any(Object),
        });
        await server.close();
    });

    it('PATCH /api/v1/payments/verify returns 409 when the shared checkout service rejects finalization', async () => {
        const { server, checkoutService } = await buildServer();
        checkoutService.verifyPayment.mockResolvedValueOnce({
            success: false,
            error: 'Payment is not successful',
            order: { id: 'ord_1', status: 'payment_pending' },
        } as any);
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

        expect(response.statusCode).toBe(409);
        expect(response.json()).toMatchObject({
            success: false,
            error: 'Payment is not successful',
            order: { id: 'ord_1', status: 'payment_pending' },
        });

        await server.close();
    });

    it('PATCH /api/v1/payments/verify rejects mock payment payloads unless explicitly enabled', async () => {
        const { server, checkoutService } = await buildServer();

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
        expect(response.json()).toMatchObject({ error: 'Mock payments are disabled' });
        expect(checkoutService.verifyPayment).not.toHaveBeenCalled();

        await server.close();
    });

    it('PATCH /api/v1/payments/verify fails closed when Razorpay signing secret is missing', async () => {
        const { server, checkoutService } = await buildServer();
        delete process.env.RAZORPAY_KEY_SECRET;

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
        expect(response.json()).toMatchObject({ error: 'Payment verification is not configured' });
        expect(checkoutService.verifyPayment).not.toHaveBeenCalled();

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
        expect(checkoutService.verifyPayment).toHaveBeenCalledWith({
            orderId: 'ord_1',
            razorpayOrderId: 'order_rzp_1',
            razorpayPaymentId: 'pay_1',
            userId: null,
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
        expect(checkoutService.recordPaymentFailure).toHaveBeenCalledWith('ord_1', 'order_rzp_1', 'pay_2');
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
            expect.objectContaining({ id: 'event_1', title: 'After Dark' })
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
            })
        );

        await server.close();
    });
});
