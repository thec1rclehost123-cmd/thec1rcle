// @ts-ignore
import { calculatePricing } from '@c1rcle/core/pricing-engine';
// @ts-ignore
import { createReservation, releaseReservation } from '@c1rcle/core/inventory-engine';
// @ts-ignore
import { sendEvent, Events } from '@c1rcle/core/inngest-client';
async function fetchWithRetry(url, options, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const response = await fetch(url, options);
            if (response.status >= 500) {
                if (i === maxRetries - 1)
                    return response;
                // Exponential backoff
                await new Promise(res => setTimeout(res, Math.pow(2, i) * 1000));
                continue;
            }
            return response;
        }
        catch (error) {
            if (i === maxRetries - 1)
                throw error;
            await new Promise(res => setTimeout(res, Math.pow(2, i) * 1000));
        }
    }
    throw new Error('Max retries reached');
}
export class CheckoutService {
    orderRepo;
    eventRepo;
    constructor(orderRepo, eventRepo) {
        this.orderRepo = orderRepo;
        this.eventRepo = eventRepo;
    }
    async validatePricing(params, workspaceId) {
        const event = await this.eventRepo.getById(params.eventId, workspaceId);
        if (!event)
            throw new Error('Event not found');
        return calculatePricing({ ...params, event });
    }
    async reserveItems(eventId, userId, deviceId, items, workspaceId) {
        const event = await this.eventRepo.getById(eventId, workspaceId);
        if (!event)
            throw new Error('Event not found');
        const result = await createReservation(event, userId, deviceId, items);
        if (result.success) {
            await this.orderRepo.createReservation({
                id: result.reservationId,
                eventId,
                customerId: userId,
                deviceId: deviceId,
                items,
                status: 'active',
                createdAt: new Date().toISOString(),
                expiresAt: result.expiresAt
            });
        }
        return result;
    }
    async initiateCheckout(params, workspaceId) {
        const { reservationId, userId, userName, userEmail, userPhone, promoCode, promoterCode } = params;
        const reservation = await this.orderRepo.getReservationById(reservationId);
        if (!reservation)
            throw new Error('Reservation not found');
        if (reservation.status !== 'active')
            throw new Error(`Reservation is ${reservation.status}`);
        if (new Date(reservation.expiresAt) < new Date()) {
            await this.orderRepo.updateReservation(reservationId, { status: 'expired' });
            throw new Error('Reservation has expired');
        }
        const event = await this.eventRepo.getById(reservation.eventId, workspaceId);
        if (!event)
            throw new Error('Event not found');
        const pricingResult = await calculatePricing({
            event,
            items: reservation.items.map((i) => ({ ...i, tierId: i.tierId || i.ticketId })),
            promoCode,
            promoterCode,
            userId
        });
        if (!pricingResult.success)
            throw new Error(pricingResult.error);
        const pricing = pricingResult.pricing;
        const orderId = `ORD-${Date.now().toString(36).toUpperCase()}`;
        const orderPayload = {
            id: orderId,
            eventId: event.id,
            eventName: event.title,
            userId,
            userName,
            userEmail,
            userPhone,
            tickets: pricing.items.map((item) => ({
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
            status: (pricing.isFree || event.isRSVP) ? 'confirmed' : 'payment_pending',
            reservationId: reservationId,
            promoterCode: promoterCode || null,
            createdAt: new Date().toISOString(),
            isRSVP: !!event.isRSVP
        };
        if (orderPayload.status === 'confirmed') {
            orderPayload.confirmedAt = orderPayload.createdAt;
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
                }
                catch (e) {
                    console.error('Inngest trigger initiation failed:', e);
                }
            })();
        }
        return {
            success: true,
            requiresPayment: !pricing.isFree && !event.isRSVP,
            order: orderPayload,
            pricing
        };
    }
    async preparePayment(orderId, userId, razorpayConfig) {
        const order = await this.orderRepo.getOrderById(orderId);
        if (!order)
            throw new Error('Order not found');
        if (order.userId !== userId)
            throw new Error('Forbidden');
        const { keyId, keySecret } = razorpayConfig;
        if (!keyId || !keySecret) {
            // Mock for Dev
            return {
                razorpayOrderId: `order_mock_${Date.now()}`,
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
            const err = await response.json();
            throw new Error(err.error?.description || "Razorpay order failed");
        }
        const rzpOrder = await response.json();
        // Store in payments collection
        await this.orderRepo.createPaymentRecord({
            orderId,
            razorpayOrderId: rzpOrder.id,
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
    async verifyPayment(params) {
        const { orderId, razorpayOrderId, razorpayPaymentId, userId } = params;
        let finalOrder = null;
        await this.orderRepo.runInTransaction(async (transaction) => {
            const order = await this.orderRepo.getOrderById(orderId);
            if (!order)
                throw new Error('Order not found');
            if (order.status === 'confirmed')
                return;
            if (order.userId !== userId)
                throw new Error('Unauthorized');
            const updates = {
                status: 'confirmed',
                paymentId: razorpayPaymentId,
                paymentOrderId: razorpayOrderId,
                confirmedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };
            await Promise.all([
                this.orderRepo.updateOrder(orderId, updates, order.isRSVP, transaction),
                this.orderRepo.updatePaymentRecord(orderId, razorpayOrderId, {
                    status: 'verified',
                    razorpayPaymentId: razorpayPaymentId,
                    verifiedAt: new Date().toISOString()
                }, transaction)
            ]);
            finalOrder = { ...order, ...updates };
        });
        // Trigger fulfillment workflow (fallback for missed webhooks)
        if (finalOrder) {
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
                }
                catch (e) {
                    console.error('Inngest trigger initiation failed in verifyPayment:', e);
                }
            })();
        }
    }
    async cancelCheckout(reservationId, orderId) {
        const promises = [];
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
