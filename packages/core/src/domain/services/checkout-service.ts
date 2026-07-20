import { IOrderRepository, Order } from '../repositories/order-repository.js';
import { IEventRepository } from '../repositories/event-repository.js';
import { InventoryService } from './inventory-service.js';
import { PaymentService } from './payment-service.js';
import { FulfillmentService } from './fulfillment-service.js';
import { CancellationService } from './cancellation-service.js';
import {
  CheckoutReconciliationError,
  assertCheckoutSnapshotCurrent,
} from './checkout-reconciliation.js';
// @ts-ignore
import { calculatePricing } from '@c1rcle/core/pricing-engine';
// @ts-ignore
import { validatePromoCode } from '@c1rcle/core/promo-service';
// @ts-ignore
import { PUBLIC_LIFECYCLE_STATES } from '@c1rcle/core/events';
// @ts-ignore
import {
  buildOrderPayload,
  cancelOrder as cancelPendingCheckoutOrder,
  cleanupStaleOrders,
  executeOrderCreation,
  isPaymentPendingOrderStatus,
  PAYMENT_PENDING_ORDER_STATUS,
} from '@c1rcle/core/order-engine';
// @ts-ignore
import { commitInventory } from '@c1rcle/core/inventory-engine';
// @ts-ignore
import { telemetry } from '@c1rcle/core/telemetry';
// @ts-ignore
import { getAdminDb } from '@c1rcle/core/admin';
// @ts-ignore
import { assertCanCheckoutEvent } from '@c1rcle/core/subscription-service';

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
  private inventoryCommitter = { commitInventory };

  constructor(
    private orderRepo: IOrderRepository,
    private eventRepo: IEventRepository,
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
    eventId: string;
    userId: string;
    deviceId: string | null;
    items: any[];
    workspaceId?: string | null;
    options?: { queueId?: string | null };
  }): Promise<any> {
    // Opportunistically restore inventory from abandoned payment attempts.
    // This is a safety net; the client also cancels an abandoned order directly.
    await cleanupStaleOrders(null, 10).catch((error: any) => {
      telemetry.error('[Checkout] Stale-order cleanup failed before reservation', error, {
        userId: params.userId,
        eventId: params.eventId,
      });
    });

    const event = await this.eventRepo.getById(
      params.eventId,
      params.workspaceId || (undefined as any),
    );
    if (!event) throw new Error('Event not found');
    const db = await getAdminDb();
    await assertCanCheckoutEvent(db, params.userId, event);

    telemetry.track('CHECKOUT_RESERVE_REQUESTED', {
      eventId: params.eventId,
      queueId: params.options?.queueId || null,
      userId: params.userId,
    });
    return this.inventory.reserve({
      ...params,
      queueId: params.options?.queueId,
    });
  }

  /**
   * Resolve a checkout preview from the authoritative event document.
   * The client never supplies prices, fees, or totals.
   */
  async validatePricing(
    params: { eventId: string; items?: any[] },
    workspaceId?: string | null,
  ): Promise<any> {
    const event = await this.eventRepo.getById(params.eventId, workspaceId || (undefined as any));
    if (!event) throw this.withCode(new Error('Event not found'), 'NOT_FOUND');
    this.inventory.assertEventAvailable(event);

    const items = Array.isArray(params.items)
      ? params.items.map((item: any) => ({
          tierId: item.tierId || item.ticketId,
          quantity: Number(item.quantity),
        }))
      : [];
    const totalQuantity = items.reduce(
      (sum: number, item: any) => sum + (Number(item.quantity) || 0),
      0,
    );
    const maxTickets = (event as any).isRSVP ? 1 : Number((event as any).maxTicketsPerOrder || 10);
    if (totalQuantity > maxTickets) {
      throw this.withCode(
        new Error(`Maximum ${maxTickets} ticket(s) per order allowed.`),
        'BAD_REQUEST',
      );
    }

    return calculatePricing({ event, items, userId: null });
  }

  /**
   * Zero-trust mobile checkout intent.
   * Client supplies only eventId, tierId, and quantity; price and totals are
   * resolved from the event document before creating the Razorpay order.
   */
  async createCheckoutIntent(params: {
    eventId: string;
    tierId: string;
    quantity: number;
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      phone?: string | null;
    };
    deviceId?: string | null;
    workspaceId?: string | null;
    reservationMinutes?: number;
    paymentGatewayConfig: {
      keyId?: string;
      keySecret?: string;
      allowMockPayment?: boolean;
    };
  }): Promise<any> {
    const { eventId, tierId, quantity, user, workspaceId = null } = params;
    const item = { tierId, quantity };
    const startTime = Date.now();

    telemetry.track('CHECKOUT_INTENT_REQUESTED', {
      eventId,
      tierId,
      quantity,
      userId: user.id,
    });

    let activeReservationId: string | null = null;
    try {
      const event = await this.eventRepo.getById(eventId, workspaceId || (undefined as any));
      if (!event) throw this.withCode(new Error('Event not found'), 'NOT_FOUND');
      const db = await getAdminDb();
      const subscriptionContext = await assertCanCheckoutEvent(db, user.id, event);

      const maxTickets = (event as any).isRSVP
        ? 1
        : Number((event as any).maxTicketsPerOrder || 10);
      if (quantity > maxTickets) {
        throw this.withCode(
          new Error(`Maximum ${maxTickets} ticket(s) per order allowed.`),
          'BAD_REQUEST',
        );
      }

      if ((event as any).isRSVP) {
        const hasExisting = await this.orderRepo.checkExistingRSVP(eventId, { userId: user.id });
        if (hasExisting) {
          throw this.withCode(new Error('Already registered. One RSVP per person.'), 'BAD_REQUEST');
        }
      }

      const reservationResult = await this.inventory.reserve({
        eventId,
        userId: user.id,
        deviceId: params.deviceId || null,
        items: [item],
        workspaceId,
        reservationMinutes: params.reservationMinutes || 5,
        strictMode: true,
      });

      const reservationId = reservationResult.reservationId;
      activeReservationId = reservationId;
      const expiresAt = reservationResult.expiresAt;
      const checkoutSnapshot = reservationResult.checkoutSnapshot;
      const pricedEvent = await this.eventRepo.getById(
        eventId,
        workspaceId || (undefined as any),
      );
      if (!pricedEvent) throw this.withCode(new Error('Event not found'), 'NOT_FOUND');
      this.inventory.assertEventAvailable(pricedEvent);
      assertCheckoutSnapshotCurrent(checkoutSnapshot, pricedEvent, [item]);
      const pricingResult = await calculatePricing({
        event: pricedEvent,
        items: [item],
        userId: user.id,
        subscriptionTier: subscriptionContext.subscription.tier,
        waiveBookingFees: subscriptionContext.subscription.isPremium,
        promoValidator: async (
          eventId: string,
          code: string,
          uid: string | null,
          pricingItems: any[],
        ) => validatePromoCode(eventId, code, uid || '', pricingItems),
      });

      if (!pricingResult.success) {
        throw this.withCode(
          new Error(pricingResult.error || 'Unable to price checkout'),
          'BAD_REQUEST',
        );
      }

      const pricing = pricingResult.pricing;
      const pricedItem = pricing.items.find((priced: any) => priced.tierId === tierId);
      if (!pricedItem) {
        throw this.withCode(new Error('Ticket tier not found'), 'BAD_REQUEST');
      }
      if (Number(pricing.grandTotal || 0) <= 0 || pricing.isFree) {
        throw this.withCode(
          new Error('Payment intent is not required for free tickets'),
          'BAD_REQUEST',
        );
      }

      const resolvedWorkspaceId = workspaceId || (pricedEvent as any).workspaceId || null;
      const reservation = {
        id: reservationId,
        eventId,
        workspaceId: resolvedWorkspaceId,
        customerId: user.id,
        deviceId: params.deviceId || null,
        queueId: null,
        items: [item],
        checkoutSnapshot,
        status: 'active',
        createdAt: new Date().toISOString(),
        expiresAt,
      };

      const orderPayload = buildOrderPayload({
        reservation,
        event: pricedEvent,
        pricing,
        user: {
          id: user.id,
          name: user.name || user.email || 'Guest',
          email: user.email || '',
          phone: user.phone || '',
        },
        workspaceId: resolvedWorkspaceId,
      });

      let order: Order | null = null;
      await this.orderRepo.runInTransaction(async (transaction) => {
        const currentReservation = await this.orderRepo.getReservationById(
          reservationId,
          transaction,
        );
        if (!currentReservation) {
          throw new CheckoutReconciliationError(undefined, ['reservation_missing']);
        }
        if (currentReservation.customerId !== user.id) {
          throw this.withCode(new Error('Forbidden'), 'FORBIDDEN');
        }
        if (currentReservation.status !== 'active') {
          if (!currentReservation.orderId) {
            throw new CheckoutReconciliationError(undefined, [
              `reservation_${currentReservation.status}`,
            ]);
          }
          const existingOrder = await this.orderRepo.getOrderById(
            currentReservation.orderId,
            transaction,
          );
          if (!existingOrder || existingOrder.reservationId !== reservationId) {
            throw new CheckoutReconciliationError(undefined, ['reservation_order_inconsistent']);
          }
          order = existingOrder;
          return;
        }

        const canonicalEvent = await this.eventRepo.getById(
          eventId,
          resolvedWorkspaceId || (undefined as any),
          transaction,
        );
        if (!canonicalEvent) throw this.withCode(new Error('Event not found'), 'NOT_FOUND');
        this.inventory.assertEventAvailable(canonicalEvent);
        assertCheckoutSnapshotCurrent(checkoutSnapshot, canonicalEvent, [item]);

        await this.inventoryCommitter.commitInventory(transaction, {
          event: canonicalEvent,
          items: orderPayload.tickets,
          reservationId,
        });
        await Promise.all([
          this.orderRepo.createOrder(orderPayload, transaction),
          this.orderRepo.updateReservation(
            reservationId,
            {
              status: 'converted',
              orderId: orderPayload.id,
              convertedAt: new Date().toISOString(),
            },
            transaction,
          ),
        ]);
        order = orderPayload;
      });

      const finalOrder = (order ?? orderPayload) as Order;
      if (!finalOrder) throw new Error('Checkout order could not be created');

      const payment = await this.preparePayment(finalOrder.id, user.id, {
        keyId: params.paymentGatewayConfig.keyId || '',
        keySecret: params.paymentGatewayConfig.keySecret || '',
        allowMockPayment: params.paymentGatewayConfig.allowMockPayment,
      });

      telemetry.track('CHECKOUT_INTENT_CREATED', {
        orderId: finalOrder.id,
        reservationId,
        eventId,
        userId: user.id,
        duration: Date.now() - startTime,
      });

      return {
        success: true,
        orderId: finalOrder.id,
        reservationId,
        razorpayOrderId: payment.razorpayOrderId,
        amount: payment.amount,
        amountPaise: Math.round(Number(payment.amount || 0) * 100),
        currency: payment.currency || 'INR',
        key: payment.key,
        expiresAt,
        pricing,
      };
    } catch (error: any) {
      if (error?.code === 'STALE_CART' && activeReservationId) {
        await this.inventory.release(activeReservationId).catch(() => undefined);
      }
      const message = String(error?.message || '');
      if (
        message.toLowerCase().includes('sold out') ||
        message.toLowerCase().includes('only ') ||
        message.toLowerCase().includes('left')
      ) {
        throw this.withCode(new Error('Sold Out'), 'SOLD_OUT');
      }

      telemetry.error('[Checkout] Intent failed', error, {
        userId: user.id,
        eventId,
        tierId,
      });
      throw error;
    }
  }

  /**
   * Core Orchestrator: Transition from reservation to order
   */
  async initiateCheckout(
    params: {
      reservationId: string;
      userId: string;
      userName: string;
      userEmail: string;
      userPhone: string;
      promoCode?: string;
      promoterCode?: string;
    },
    workspaceId?: string | null,
  ): Promise<any> {
    const { reservationId, userId, userName, userEmail, userPhone, promoCode, promoterCode } =
      params;
    const startTime = Date.now();

    try {
      // 1. Validate Reservation
      const reservation = await this.inventory.validateAndExpire(reservationId);

      if (reservation.customerId !== userId) {
        throw this.withCode(new Error('Forbidden'), 'FORBIDDEN');
      }

      const existingOrder = await this.orderRepo.getOrderByReservationId(reservationId);
      if (existingOrder && reservation.status !== 'active') {
        return this.buildExistingOrderResponse(existingOrder, reservationId);
      }

      if (reservation.status !== 'active') throw new Error(`Reservation is ${reservation.status}`);

      // 2. Pricing & Valuation
      const resolvedWorkspaceId = workspaceId || reservation.workspaceId || null;
      const event = await this.eventRepo.getById(
        reservation.eventId,
        resolvedWorkspaceId || (undefined as any),
      );
      if (!event) throw new Error('Event not found');
      this.inventory.assertEventAvailable(event);
      assertCheckoutSnapshotCurrent(reservation.checkoutSnapshot, event, reservation.items);
      const db = await getAdminDb();
      const subscriptionContext = await assertCanCheckoutEvent(db, userId, event);

      const totalQuantity = reservation.items.reduce(
        (sum: number, item: any) => sum + (Number(item.quantity) || 0),
        0,
      );
      const maxTickets = (event as any).isRSVP
        ? 1
        : Number((event as any).maxTicketsPerOrder || 10);
      if (totalQuantity > maxTickets) {
        throw new Error(`Maximum ${maxTickets} ticket(s) per order allowed.`);
      }

      const pricingResult = await calculatePricing({
        event,
        items: reservation.items.map((i: any) => ({ ...i, tierId: i.tierId || i.ticketId })),
        promoCode,
        promoterCode,
        userId,
        subscriptionTier: subscriptionContext.subscription.tier,
        waiveBookingFees: subscriptionContext.subscription.isPremium,
        promoValidator: async (
          eventId: string,
          code: string,
          uid: string | null,
          pricingItems: any[],
        ) => validatePromoCode(eventId, code, uid || '', pricingItems),
      });

      if (!pricingResult.success) throw new Error(pricingResult.error);
      const pricing = pricingResult.pricing;

      if (existingOrder) {
        return this.buildExistingOrderResponse(
          existingOrder,
          reservationId,
          pricing,
          promoterCode || null,
        );
      }

      // 3. Build Authoritative Payload (Logic moved to Engine)
      const orderPayload = buildOrderPayload({
        reservation,
        event,
        pricing,
        user: { id: userId, name: userName, email: userEmail, phone: userPhone },
        promoterCode,
        workspaceId: resolvedWorkspaceId,
      });

      // Phase 1: Atomic Commit — RSVP uniqueness check runs inside the transaction
      // so concurrent requests cannot both pass the check before either writes.
      let createdOrder: any = null;
      await db.runTransaction(async (transaction: any) => {
        const currentReservation = await this.orderRepo.getReservationById(
          reservationId,
          transaction,
        );
        if (!currentReservation) {
          throw new CheckoutReconciliationError(undefined, ['reservation_missing']);
        }
        if (currentReservation.customerId !== userId) {
          throw this.withCode(new Error('Forbidden'), 'FORBIDDEN');
        }
        if (currentReservation.status !== 'active') {
          if (!currentReservation.orderId) {
            throw new CheckoutReconciliationError(undefined, [
              `reservation_${currentReservation.status}`,
            ]);
          }
          const currentOrder = await this.orderRepo.getOrderById(
            currentReservation.orderId,
            transaction,
          );
          if (!currentOrder || currentOrder.reservationId !== reservationId) {
            throw new CheckoutReconciliationError(undefined, ['reservation_order_inconsistent']);
          }
          createdOrder = currentOrder;
          return;
        }

        const canonicalEvent = await this.eventRepo.getById(
          event.id,
          resolvedWorkspaceId || (undefined as any),
          transaction,
        );
        if (!canonicalEvent) throw new Error('Event not found');
        this.inventory.assertEventAvailable(canonicalEvent);
        assertCheckoutSnapshotCurrent(
          reservation.checkoutSnapshot,
          canonicalEvent,
          reservation.items,
        );

        if ((canonicalEvent as any).isRSVP) {
          const hasExistingRSVP = await this.orderRepo.checkExistingRSVP(
            canonicalEvent.id,
            { userId, email: userEmail },
            transaction,
          );
          if (hasExistingRSVP) throw new Error('Already registered. One RSVP per person.');
        }

        createdOrder = await executeOrderCreation(transaction, {
          db,
          event: canonicalEvent,
          orderData: orderPayload,
          reservationId: reservationId,
          inventoryEngine: this.inventoryCommitter,
        });

        // Firestore transactions require every read to happen before the first
        // write. Order creation reads inventory, so profile persistence belongs
        // after that read set has completed.
        if (userEmail && userId) {
          transaction.set(
            db.collection('users').doc(userId),
            { email: userEmail },
            { merge: true },
          );
        }
      });
      const finalOrder = (createdOrder || orderPayload) as Order;

      telemetry.track('CHECKOUT_INITIATED', {
        orderId: finalOrder.id,
        userId,
        eventId: event.id,
        duration: Date.now() - startTime,
      });

      // Phase 2: Fulfillment or Payment Readiness
      if (finalOrder.status === 'confirmed') {
        await this.fulfillment.processFulfillment(finalOrder, reservation.queueId);
      }

      return {
        success: true,
        requiresPayment: isPaymentPendingOrderStatus(finalOrder.status),
        order: finalOrder,
        pricing,
      };
    } catch (error: any) {
      if (error?.code === 'STALE_CART') {
        await this.inventory.release(reservationId).catch(() => undefined);
      }
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

    try {
      const event = await this.eventRepo.getById(
        order.eventId,
        order.workspaceId || (undefined as any),
      );
      if (!event) throw new CheckoutReconciliationError(undefined, ['event_missing']);
      this.inventory.assertEventAvailable(event);
      assertCheckoutSnapshotCurrent(order.checkoutSnapshot, event, order.tickets);
    } catch (error: any) {
      if (error?.code === 'STALE_CART' || error?.code === 'EVENT_NOT_PURCHASABLE') {
        await cancelPendingCheckoutOrder(order.id).catch(() => undefined);
        if (order.reservationId) {
          await this.inventory.release(order.reservationId).catch(() => undefined);
        }
      }
      throw error;
    }

    return this.payment.prepareRazorpayOrder({ order, userId, config: razorpayConfig });
  }

  async verifyPayment(params: {
    orderId: string;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    userId?: string | null;
    paymentGatewayConfig?: {
      keyId?: string;
      keySecret?: string;
      allowMockPayment?: boolean;
    };
  }): Promise<any> {
    const {
      orderId,
      razorpayOrderId,
      razorpayPaymentId,
      userId = null,
      paymentGatewayConfig,
    } = params;
    telemetry.track('CHECKOUT_PAYMENT_VERIFY_REQUESTED', {
      orderId,
      razorpayPaymentId,
      userId,
    });

    const paymentRecord = await this.orderRepo.getPaymentRecord(orderId, razorpayOrderId);
    if (!paymentRecord) {
      throw new Error('Payment order not found');
    }
    if (userId && paymentRecord.userId !== userId) {
      throw new Error('Unauthorized');
    }

    const existingPaymentLink = await this.orderRepo.getPaymentRecordByPaymentId(razorpayPaymentId);
    if (existingPaymentLink && existingPaymentLink.orderId !== orderId) {
      throw new Error('Payment already linked to another order');
    }

    if (paymentGatewayConfig) {
      await this.payment.validateGatewayPayment({
        paymentRecord,
        razorpayOrderId,
        razorpayPaymentId,
        config: paymentGatewayConfig,
      });
    }

    let finalOrder: any = null;
    await this.orderRepo.runInTransaction(async (transaction) => {
      const order = await this.orderRepo.getOrderById(orderId, transaction);
      if (!order) {
        finalOrder = order;
        return;
      }
      if (userId && order.userId !== userId) {
        throw new Error('Unauthorized');
      }

      const currentPaymentRecord = await this.orderRepo.getPaymentRecord(
        orderId,
        razorpayOrderId,
        transaction,
      );
      if (!currentPaymentRecord) {
        throw new Error('Payment order not found');
      }
      if (currentPaymentRecord.userId !== order.userId) {
        throw new Error('Unauthorized');
      }
      if (Number(currentPaymentRecord.amount) !== Number(order.totalAmount)) {
        throw new Error('Payment amount mismatch');
      }

      const linkedPayment = await this.orderRepo.getPaymentRecordByPaymentId(
        razorpayPaymentId,
        transaction,
      );
      if (linkedPayment && linkedPayment.orderId !== orderId) {
        throw new Error('Payment already linked to another order');
      }
      if (order.status === 'confirmed') {
        finalOrder = { ...order, alreadyConfirmed: true };
        return;
      }

      if (order.reservationId) {
        const res = await this.orderRepo.getReservationById(order.reservationId, transaction);
        if (res && res.status === 'expired') {
          const event = await this.eventRepo.getById(
            order.eventId,
            order.workspaceId || (undefined as any),
          );
          if (event && this.isInventoryExhausted(event, order.tickets)) {
            finalOrder = { ...order, verifyError: 'RESERVATION_EXPIRED_OVERSOLD' };
            return;
          }
        }
      }

      const updates: Partial<Order> = {
        status: 'confirmed',
        paymentId: razorpayPaymentId,
        paymentOrderId: razorpayOrderId,
        confirmedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await Promise.all([
        this.orderRepo.updateOrder(orderId, updates, order.isRSVP, transaction),
        this.payment.recordPaymentVerification(
          orderId,
          razorpayOrderId,
          razorpayPaymentId,
          transaction,
        ),
      ]);

      finalOrder = { ...order, ...updates };
    });

    if (finalOrder?.verifyError === 'RESERVATION_EXPIRED_OVERSOLD') {
      return {
        success: false,
        error: 'Your reservation expired and the event sold out. Please contact support.',
        order: finalOrder,
      };
    }

    if (finalOrder && finalOrder.status === 'confirmed' && !finalOrder.alreadyConfirmed) {
      await this.fulfillment.processFulfillment(finalOrder, finalOrder.queueId || null);
    }

    return {
      success: true,
      alreadyConfirmed: Boolean(finalOrder?.alreadyConfirmed),
      order: finalOrder,
    };
  }

  private isInventoryExhausted(event: any, tickets: any[]): boolean {
    const tiers: any[] = event.ticketCatalog?.tiers || event.tickets || [];
    for (const orderTicket of tickets) {
      const tier = tiers.find((t: any) => t.id === orderTicket.ticketId);
      if (!tier) continue;
      const inv = tier.inventory;
      if (inv) {
        const capacity = Number(inv.totalQuantity ?? inv.capacity ?? 0);
        const sold = Number(inv.soldQuantity ?? 0);
        const held = Number(inv.heldQuantity ?? 0);
        if (capacity > 0 && sold + held >= capacity) return true;
      } else {
        if (Number(tier.remaining ?? tier.quantity ?? 999) <= 0) return true;
      }
    }
    return false;
  }

  async reissueFulfillment(order: Order): Promise<void> {
    await this.fulfillment.processFulfillment(order, null);
  }

  async recordPaymentFailure(
    orderId: string,
    razorpayOrderId: string,
    razorpayPaymentId?: string | null,
  ): Promise<void> {
    await this.payment.recordPaymentFailure(orderId, razorpayOrderId, razorpayPaymentId);
  }

  /**
   * Helpers
   */
  private buildExistingOrderResponse(
    order: Order,
    reservationId: string,
    pricing: any = null,
    promoterCode: string | null = null,
  ) {
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

  private withCode<T extends Error>(error: T, code: string): T & { code: string } {
    return Object.assign(error, { code });
  }

  /**
   * Cancellation Orchestration
   */
  async cancelOrder(params: any, options: any = {}) {
    const { order, event, cancelledBy, cancelledByType } = params;
    telemetry.track('CHECKOUT_CANCEL_REQUESTED', {
      cancelledBy,
      cancelledByType,
      eventId: event?.id || order?.eventId || null,
      orderId: order.id,
    });

    // Mobile may retry cleanup after the server committed cancellation but the
    // response was lost. Treat the terminal state as success so local recovery
    // data can be cleared without re-running refund/cancellation policy.
    if (order.status === 'cancelled') {
      await this.failLatestPendingPayment(order.id);
      if (order.reservationId) {
        await this.inventory.release(order.reservationId).catch(() => undefined);
      }
      return {
        success: true,
        orderId: order.id,
        status: 'cancelled',
        alreadyCancelled: true,
        refund: {
          percentage: 0,
          amount: 0,
          status: 'not_applicable',
        },
      };
    }

    // An unpaid order has already decremented event inventory. It must use the
    // order engine's transactional cancellation path to put those tickets back.
    if (isPaymentPendingOrderStatus(order.status)) {
      await cancelPendingCheckoutOrder(order.id);
      await this.failLatestPendingPayment(order.id);
      if (order.reservationId) {
        await this.inventory.release(order.reservationId).catch(() => undefined);
      }
      return {
        success: true,
        orderId: order.id,
        status: 'cancelled',
        refund: {
          percentage: 0,
          amount: 0,
          status: 'not_applicable',
        },
      };
    }

    const result = await this.cancellation.cancel({
      ...params,
      refundPayment: options.refundPayment,
    });

    if (order.reservationId) {
      await this.inventory.release(order.reservationId).catch(() => undefined);
    }

    return {
      success: result.success,
      orderId: order.id,
      refund: {
        percentage: result.decision.refundPercentage,
        amount: result.decision.refundAmount,
        status: result.refundResult ? 'processing' : 'not_applicable',
        razorpayRefundId: result.refundResult?.id,
      },
    };
  }

  async getCancellationDecision(order: any, event: any) {
    return this.cancellation.getDecision(order, event);
  }

  private async failLatestPendingPayment(orderId: string): Promise<void> {
    const pendingPayment = await this.orderRepo.getLatestPendingPaymentRecord(orderId);
    if (pendingPayment) {
      await this.payment.recordPaymentFailure(orderId, pendingPayment.razorpayOrderId);
    }
  }

  async releaseReservation(reservationId: string) {
    return this.inventory.release(reservationId);
  }
}
