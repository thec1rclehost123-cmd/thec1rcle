import { IOrderRepository, Order, Reservation, PaymentRecord } from '../repositories/order-repository.js';
import { IEventRepository } from '../repositories/event-repository.js';
// @ts-ignore
import { calculatePricing } from '@c1rcle/core/pricing-engine';
// @ts-ignore
import { createReservation, releaseReservation } from '@c1rcle/core/inventory-engine';
// @ts-ignore
import { consumeAdmission } from '@c1rcle/core/surge';
// @ts-ignore
import { sendEvent, Events } from '@c1rcle/core/inngest-client';
// @ts-ignore
import { getAdminDb } from '@c1rcle/core/admin';
import { FieldValue } from 'firebase-admin/firestore';

async function fetchWithRetry(url: string, options: any, maxRetries = 3): Promise<Response> {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.status >= 500) {
                if (i === maxRetries - 1) return response;
                // Exponential backoff
                await new Promise(res => setTimeout(res, Math.pow(2, i) * 1000));
                continue;
            }
            return response;
        } catch (error) {
            if (i === maxRetries - 1) throw error;
            await new Promise(res => setTimeout(res, Math.pow(2, i) * 1000));
        }
    }
    throw new Error('Max retries reached');
}


export class CheckoutService {
    constructor(
        private orderRepo: IOrderRepository,
        private eventRepo: IEventRepository
    ) { }

    async validatePricing(params: any, workspaceId?: string | null): Promise<any> {
        const event = await this.eventRepo.getById(params.eventId, workspaceId || undefined as any);
        if (!event) throw new Error('Event not found');

        return calculatePricing({ ...params, event });
    }

    async reserveItems(
        eventId: string,
        userId: string,
        deviceId: string | null,
        items: any[],
        workspaceId?: string | null,
        options: { queueId?: string | null } = {}
    ): Promise<any> {
        const event = await this.eventRepo.getById(eventId, workspaceId || undefined as any);
        if (!event) throw new Error('Event not found');

        const result = await createReservation(event, userId, deviceId, items);
        const resolvedWorkspaceId = workspaceId || (event as any).workspaceId || null;

        if (result.success) {
            await this.orderRepo.createReservation({
                id: result.reservationId,
                eventId,
                workspaceId: resolvedWorkspaceId,
                customerId: userId,
                deviceId: deviceId,
                queueId: options.queueId || null,
                items,
                status: 'active',
                createdAt: new Date().toISOString(),
                expiresAt: result.expiresAt
            });
        }

        return result;
    }

    async initiateCheckout(params: {
        reservationId: string,
        userId: string,
        userName: string,
        userEmail: string,
        userPhone: string,
        promoCode?: string,
        promoterCode?: string
    }, workspaceId?: string | null): Promise<any> {
        const { reservationId, userId, userName, userEmail, userPhone, promoCode, promoterCode } = params;

        const reservation = await this.orderRepo.getReservationById(reservationId);
        if (!reservation) throw new Error('Reservation not found');
        if (reservation.status !== 'active') throw new Error(`Reservation is ${reservation.status}`);
        if (new Date(reservation.expiresAt) < new Date()) {
            await this.orderRepo.updateReservation(reservationId, { status: 'expired' });
            throw new Error('Reservation has expired');
        }

        const resolvedWorkspaceId = workspaceId || reservation.workspaceId || null;
        const event = await this.eventRepo.getById(reservation.eventId, resolvedWorkspaceId || undefined as any);
        if (!event) throw new Error('Event not found');

        const pricingResult = await calculatePricing({
            event,
            items: reservation.items.map((i: any) => ({ ...i, tierId: i.tierId || i.ticketId })),
            promoCode,
            promoterCode,
            userId
        });

        if (!pricingResult.success) throw new Error(pricingResult.error);
        const pricing = pricingResult.pricing;

        const orderId = `ORD-${Date.now().toString(36).toUpperCase()}`;
        const orderPayload: Order = {
            id: orderId,
            eventId: event.id,
            eventName: (event as any).title,
            workspaceId: resolvedWorkspaceId || (event as any).workspaceId || null,
            userId,
            userName,
            userEmail,
            userPhone,
            tickets: pricing.items.map((item: any) => ({
                ticketId: item.tierId,
                name: item.tierName,
                quantity: item.quantity,
                price: item.unitPrice,
                total: item.subtotal
            })),
            subtotal: pricing.subtotal,
            discounts: pricing.discounts,
            discountTotal: pricing.discountTotal,
            fees: pricing.fees,
            totalAmount: pricing.grandTotal,
            status: (pricing.isFree || (event as any).isRSVP) ? 'confirmed' : 'payment_pending',
            reservationId: reservationId,
            promoterCode: promoterCode || null,
            createdAt: new Date().toISOString(),
            isRSVP: !!(event as any).isRSVP
        };

        if (orderPayload.status === 'confirmed') {
            (orderPayload as any).confirmedAt = orderPayload.createdAt;
        }

        await this.orderRepo.runInTransaction(async (transaction) => {
            await this.orderRepo.createOrder(orderPayload, transaction);
            await this.orderRepo.updateReservation(reservationId, {
                status: 'converted',
                orderId: orderId,
                convertedAt: new Date().toISOString()
            }, transaction);
        });

        // Handle Inngest trigger after transaction (Non-blocking)
        if (orderPayload.status === 'confirmed') {
            (async () => {
                try {
                    sendEvent(Events.TICKET_PURCHASED, {
                        orderId: orderPayload.id,
                        userId: orderPayload.userId,
                        userEmail: orderPayload.userEmail,
                        eventId: orderPayload.eventId,
                        tickets: orderPayload.tickets,
                        totalAmount: orderPayload.totalAmount,
                        promoterCode: orderPayload.promoterCode
                    });
                } catch (e) {
                    console.error('Inngest trigger initiation failed:', e);
                }
            })();
        }

        return {
            success: true,
            requiresPayment: !pricing.isFree && !(event as any).isRSVP,
            order: orderPayload,
            pricing
        };
    }

    async preparePayment(orderId: string, userId: string, razorpayConfig: any): Promise<any> {
        const order = await this.orderRepo.getOrderById(orderId);
        if (!order) throw new Error('Order not found');
        if (order.userId !== userId) throw new Error('Forbidden');
        if (order.status === 'confirmed') {
            throw new Error('Order is already confirmed');
        }
        if (order.status !== 'payment_pending') {
            throw new Error(`Order is ${order.status}`);
        }

        const { keyId, keySecret } = razorpayConfig;
        if (!keyId || !keySecret) {
            if (process.env.NODE_ENV === 'production') {
                throw new Error('Payment gateway is not configured');
            }
            // Mock for Dev/Test only
            const razorpayOrderId = `order_mock_${Date.now()}`;
            await this.orderRepo.createPaymentRecord({
                orderId,
                razorpayOrderId,
                workspaceId: order.workspaceId || null,
                amount: order.totalAmount,
                status: 'initiated',
                userId,
                createdAt: new Date().toISOString()
            });
            return {
                razorpayOrderId,
                amount: order.totalAmount,
                currency: "INR",
                key: "rzp_test_DEVELOPMENT"
            };
        }

        const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString("base64");
        const response = await fetchWithRetry("https://api.razorpay.com/v1/orders", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Basic ${authHeader}`
            },
            body: JSON.stringify({
                amount: Math.round(order.totalAmount * 100),
                currency: "INR",
                receipt: orderId,
                notes: { orderId, userId }
            })
        });

        if (!response.ok) {
            const err = await response.json() as any;
            throw new Error(err.error?.description || "Razorpay order failed");
        }

        const rzpOrder = await response.json() as any;

        // Store in payments collection
        await this.orderRepo.createPaymentRecord({
            orderId,
            razorpayOrderId: rzpOrder.id,
            workspaceId: order.workspaceId || null,
            amount: order.totalAmount,
            status: 'initiated',
            userId,
            createdAt: new Date().toISOString()
        });

        return {
            razorpayOrderId: rzpOrder.id,
            amount: order.totalAmount,
            currency: "INR",
            key: keyId
        };
    }

    async verifyPayment(params: {
        orderId: string,
        razorpayOrderId: string,
        razorpayPaymentId: string,
        userId: string
    }): Promise<{ success: true, alreadyConfirmed: boolean, order: Order | null }> {
        const { orderId, razorpayOrderId, razorpayPaymentId, userId } = params;

        const order = await this.orderRepo.getOrderById(orderId);
        if (!order) throw new Error('Order not found');
        if (order.userId !== userId) throw new Error('Unauthorized');

        const replayPayment = await this.orderRepo.getPaymentRecordByPaymentId(razorpayPaymentId);
        if (replayPayment && replayPayment.orderId !== orderId) {
            throw new Error('Payment already linked to another order');
        }

        if (order.status === 'confirmed') {
            return { success: true, alreadyConfirmed: true, order };
        }

        let finalOrder: any = null;

        await this.orderRepo.runInTransaction(async (transaction) => {
            const freshOrder = await this.orderRepo.getOrderById(orderId);
            if (!freshOrder) throw new Error('Order not found');
            if (freshOrder.status === 'confirmed') {
                finalOrder = freshOrder;
                return;
            }
            if (freshOrder.userId !== userId) throw new Error('Unauthorized');

            const updates: Partial<Order> = {
                status: 'confirmed',
                paymentId: razorpayPaymentId,
                paymentOrderId: razorpayOrderId,
                confirmedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            await Promise.all([
                this.orderRepo.updateOrder(orderId, updates, freshOrder.isRSVP, transaction),
                this.orderRepo.updatePaymentRecord(orderId, razorpayOrderId, {
                    status: 'verified',
                    razorpayPaymentId: razorpayPaymentId,
                    verifiedAt: new Date().toISOString()
                }, transaction)
            ]);

            finalOrder = { ...freshOrder, ...updates };
        });

        // Trigger fulfillment workflow (fallback for missed webhooks)
        if (finalOrder) {
            if (finalOrder.reservationId) {
                try {
                    const reservation = await this.orderRepo.getReservationById(finalOrder.reservationId);
                    if (reservation?.queueId) {
                        await consumeAdmission(getAdminDb(), reservation.queueId);
                    }
                } catch (e: any) {
                    console.error('[checkout] failed to consume queue admission:', e.message);
                }
            }

            // Fire-and-forget: update event stats so analytics are current
            (async () => {
                try {
                    const db = getAdminDb();
                    const ticketsCount = (finalOrder.tickets || []).reduce(
                        (s: number, t: any) => s + (t.quantity || 1), 0
                    ) || 1;
                    await db.collection('events').doc(finalOrder.eventId).update({
                        'stats.ticketsSold': FieldValue.increment(ticketsCount),
                        'stats.totalRevenue': FieldValue.increment(finalOrder.totalAmount || 0),
                    });
                } catch (e: any) {
                    console.error('[checkout] event stats update failed:', e.message);
                }
            })();

            (async () => {
                try {
                    sendEvent(Events.TICKET_PURCHASED, {
                        orderId: finalOrder.id,
                        userId: finalOrder.userId,
                        userEmail: finalOrder.userEmail,
                        eventId: finalOrder.eventId,
                        tickets: finalOrder.tickets,
                        totalAmount: finalOrder.totalAmount,
                        promoterCode: finalOrder.promoterCode
                    });
                } catch (e) {
                    console.error('Inngest trigger initiation failed in verifyPayment:', e);
                }
            })();
        }

        return { success: true, alreadyConfirmed: false, order: finalOrder };
    }

    async cancelCheckout(reservationId: string, orderId?: string): Promise<any> {
        const promises: Promise<any>[] = [];

        if (orderId) {
            // Use legacy fallback if isRSVP is unknown during cancellation
            promises.push(this.orderRepo.updateOrder(orderId, {
                status: 'cancelled',
                updatedAt: new Date().toISOString()
            }).catch(() => { }));
        }

        promises.push(releaseReservation(reservationId));

        if (reservationId) {
            promises.push(this.orderRepo.updateReservation(reservationId, {
                status: 'released',
                releasedAt: new Date().toISOString()
            }).catch(() => { }));
        }

        const results = await Promise.all(promises);
        // Find result from releaseReservation call
        return results[orderId ? 1 : 0];
    }
}
