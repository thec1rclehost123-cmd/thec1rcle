import { IOrderRepository, Order } from '../repositories/order-repository.js';
import { IEventRepository } from '../repositories/event-repository.js';
import { InventoryService } from './inventory-service.js';
import { PaymentService } from './payment-service.js';
import { FulfillmentService } from './fulfillment-service.js';
import { CancellationService } from './cancellation-service.js';
// @ts-ignore
import { calculatePricing } from '@c1rcle/core/pricing-engine';
// @ts-ignore
import { PUBLIC_LIFECYCLE_STATES } from '@c1rcle/core/events';
// @ts-ignore
import {
    buildOrderPayload,
    executeOrderCreation,
    isPaymentPendingOrderStatus,
    PAYMENT_PENDING_ORDER_STATUS,
} from '@c1rcle/core/order-engine';
// @ts-ignore
import { telemetry } from '@c1rcle/core/telemetry';
// @ts-ignore
import { getAdminDb } from '@c1rcle/core/admin';

/**
 * Optimized Checkout Orchestrator
 * 
 * Decomposed into:
 * - InventoryService: Reservation and locking
 * - PaymentService: Gateway interactions
 * - FulfillmentService: Post-payment side-effects
 */
export class CheckoutService {
    private inventory: InventoryService;
    private payment: PaymentService;
    private fulfillment: FulfillmentService;
    private cancellation: CancellationService;

    constructor(
        private orderRepo: IOrderRepository,
        private eventRepo: IEventRepository
    ) {
        this.inventory = new InventoryService(orderRepo, eventRepo);
        this.payment = new PaymentService(orderRepo);
        this.fulfillment = new FulfillmentService();
        this.cancellation = new CancellationService(orderRepo, eventRepo);
    }

    /**
     * Entry Point: Reserve items before checkout
     */
    async reserveItems(params: {
        eventId: string,
        userId: string,
        deviceId: string | null,
        items: any[],
        workspaceId?: string | null,
        options?: { queueId?: string | null }
    }): Promise<any> {
        console.log(`[Checkout] Reserving items for user ${params.userId} on event ${params.eventId}`);
        return this.inventory.reserve({
            ...params,
            queueId: params.options?.queueId
        });
    }

    /**
     * Core Orchestrator: Transition from reservation to order
     */
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
        const startTime = Date.now();

        try {
            // 1. Validate Reservation
            const reservation = await this.inventory.validateAndExpire(reservationId);
            
            const existingOrder = await this.orderRepo.getOrderByReservationId(reservationId);
            if (existingOrder && reservation.status !== 'active') {
                return this.buildExistingOrderResponse(existingOrder, reservationId);
            }

            if (reservation.status !== 'active') throw new Error(`Reservation is ${reservation.status}`);

            // 2. Pricing & Valuation
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

            if (existingOrder) {
                return this.buildExistingOrderResponse(existingOrder, reservationId, pricing, promoterCode || null);
            }

            // 3. Build Authoritative Payload (Logic moved to Engine)
            const orderPayload = buildOrderPayload({
                reservation,
                event,
                pricing,
                user: { id: userId, name: userName, email: userEmail, phone: userPhone },
                promoterCode,
                workspaceId: resolvedWorkspaceId
            });

            // Phase 1: Atomic Commit — RSVP uniqueness check runs inside the transaction
            // so concurrent requests cannot both pass the check before either writes.
            const db = await getAdminDb();
            await db.runTransaction(async (transaction: any) => {
                if ((event as any).isRSVP) {
                    const hasExistingRSVP = await this.orderRepo.checkExistingRSVP(
                        event.id, { userId, email: userEmail }, transaction
                    );
                    if (hasExistingRSVP) throw new Error('Already registered. One RSVP per person.');
                }
                await executeOrderCreation(transaction, {
                    db,
                    event,
                    orderData: orderPayload,
                    reservationId: reservationId
                });
            });

            telemetry.track("CHECKOUT_INITIATED", { 
                orderId: orderPayload.id, 
                userId, 
                eventId: event.id,
                duration: Date.now() - startTime 
            });

            // Phase 2: Fulfillment or Payment Readiness
            if (orderPayload.status === 'confirmed') {
                await this.fulfillment.processFulfillment(orderPayload, reservation.queueId);
            }

            return {
                success: true,
                requiresPayment: isPaymentPendingOrderStatus(orderPayload.status),
                order: orderPayload,
                pricing
            };
        } catch (error: any) {
            telemetry.error('[Checkout] Initiation failed', error, { userId, reservationId });
            throw error;
        }
    }

    /**
     * Payment Orchestration
     */
    async preparePayment(orderId: string, userId: string, razorpayConfig: any): Promise<any> {
        const order = await this.orderRepo.getOrderById(orderId);
        if (!order) throw new Error('Order not found');
        if (order.userId !== userId) throw new Error('Forbidden');
        if (!isPaymentPendingOrderStatus(order.status)) throw new Error(`Order is ${order.status}`);

        return this.payment.prepareRazorpayOrder({ order, userId, config: razorpayConfig });
    }

    async verifyPayment(params: {
        orderId: string,
        razorpayOrderId: string,
        razorpayPaymentId: string,
        userId: string
    }): Promise<any> {
        const { orderId, razorpayOrderId, razorpayPaymentId, userId } = params;
        console.log(`[Checkout] Verifying payment ${razorpayPaymentId} for order ${orderId}`);

        let finalOrder: any = null;
        await this.orderRepo.runInTransaction(async (transaction) => {
            const order = await this.orderRepo.getOrderById(orderId);
            if (!order) {
                finalOrder = order;
                return;
            }
            if (order.status === 'confirmed') {
                finalOrder = { ...order, alreadyConfirmed: true };
                return;
            }

            const updates: Partial<Order> = {
                status: 'confirmed',
                paymentId: razorpayPaymentId,
                paymentOrderId: razorpayOrderId,
                confirmedAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            await Promise.all([
                this.orderRepo.updateOrder(orderId, updates, order.isRSVP, transaction),
                this.payment.recordPaymentVerification(orderId, razorpayOrderId, razorpayPaymentId, transaction)
            ]);

            finalOrder = { ...order, ...updates };
        });

        if (finalOrder && finalOrder.status === 'confirmed' && !finalOrder.alreadyConfirmed) {
            const reservation = finalOrder.reservationId ? await this.orderRepo.getReservationById(finalOrder.reservationId) : null;
            await this.fulfillment.processFulfillment(finalOrder, reservation?.queueId);
        }

        return {
            success: true,
            alreadyConfirmed: Boolean(finalOrder?.alreadyConfirmed),
            order: finalOrder,
        };
    }

    /**
     * Helpers
     */
    private buildExistingOrderResponse(order: Order, reservationId: string, pricing: any = null, promoterCode: string | null = null) {
        const requiresPayment = !order.isRSVP && isPaymentPendingOrderStatus(order.status);
        return {
            success: true,
            requiresPayment,
            order,
            reservationId,
            pricing,
            promoterCode,
            message: order.status === 'confirmed' ? 'Order confirmed!' : 'Checkout initiated.',
            normalizedStatus: requiresPayment ? PAYMENT_PENDING_ORDER_STATUS : order.status,
        };
    }

    /**
     * Cancellation Orchestration
     */
    async cancelOrder(params: any, options: any = {}) {
        const { order, event, cancelledBy, cancelledByType } = params;
        console.log(`[Checkout] Cancelling order ${order.id} by ${cancelledBy}`);
        
        const result = await this.cancellation.cancel({
            ...params,
            refundPayment: options.refundPayment
        });

        if (order.reservationId) {
            await this.inventory.release(order.reservationId).catch(() => undefined);
        }

        return result;
    }

    async getCancellationDecision(order: any, event: any) {
        return this.cancellation.getDecision(order, event);
    }
}
