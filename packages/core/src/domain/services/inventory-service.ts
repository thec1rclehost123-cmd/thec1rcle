import { IOrderRepository } from '../repositories/order-repository.js';
import { IEventRepository } from '../repositories/event-repository.js';
// @ts-ignore
import { createReservation, releaseReservation } from '@c1rcle/core/inventory-engine';
// @ts-ignore
import { PUBLIC_LIFECYCLE_STATES } from '@c1rcle/core/events';
import { buildCheckoutSnapshot } from './checkout-reconciliation.js';

export class InventoryService {
  constructor(
    private orderRepo: IOrderRepository,
    private eventRepo: IEventRepository,
  ) {}

  async reserve(params: {
    eventId: string;
    userId: string;
    deviceId: string | null;
    items: any[];
    workspaceId?: string | null;
    queueId?: string | null;
    reservationMinutes?: number;
    strictMode?: boolean;
  }): Promise<any> {
    const { eventId, userId, deviceId, items, workspaceId, queueId } = params;

    const event = await this.eventRepo.getById(eventId, workspaceId || (undefined as any));
    if (!event) throw new Error('Event not found');

    this.assertEventAvailable(event);

    const checkoutSnapshot = buildCheckoutSnapshot(event, items);

    const result = await createReservation(event, userId, deviceId, items, {
      reservationMinutes: params.reservationMinutes,
      strictMode: params.strictMode,
      checkoutSnapshot,
    });
    const resolvedWorkspaceId = workspaceId || (event as any).workspaceId || null;

    if (result.success) {
      await this.orderRepo.createReservation({
        id: result.reservationId,
        eventId,
        workspaceId: resolvedWorkspaceId,
        customerId: userId,
        deviceId: deviceId,
        queueId: queueId || null,
        items,
        checkoutSnapshot: result.checkoutSnapshot || checkoutSnapshot,
        status: 'active',
        createdAt: new Date().toISOString(),
        expiresAt: result.expiresAt,
      });
    }

    return {
      ...result,
      checkoutSnapshot: result.checkoutSnapshot || checkoutSnapshot,
    };
  }

  async release(reservationId: string): Promise<any> {
    const result = await releaseReservation(reservationId);

    await this.orderRepo
      .updateReservation(reservationId, {
        status: 'released',
        releasedAt: new Date().toISOString(),
      })
      .catch(() => {
        // Ignore if reservation already deleted or not found in repo
      });

    return result;
  }

  async validateAndExpire(reservationId: string): Promise<any> {
    const reservation = await this.orderRepo.getReservationById(reservationId);
    if (!reservation) throw new Error('Reservation not found');

    if (new Date(reservation.expiresAt) < new Date()) {
      await this.orderRepo.updateReservation(reservationId, { status: 'expired' });
      throw new Error('Reservation has expired');
    }

    return reservation;
  }

  assertEventAvailable(event: any, now = Date.now()): void {
    if (!PUBLIC_LIFECYCLE_STATES.includes(event?.lifecycle)) {
      throw this.unavailableError(this.buildUnavailableMessage(event?.lifecycle));
    }

    const eventCutoff = this.toMillis(
      event?.endDate ?? event?.endAt ?? event?.startDate ?? event?.startAt ?? event?.date,
    );
    if (eventCutoff !== null && eventCutoff <= now) {
      throw this.unavailableError('This event has already ended.');
    }
  }

  private unavailableError(message: string): Error {
    return Object.assign(new Error(message), {
      code: 'EVENT_NOT_PURCHASABLE',
      statusCode: 409,
    });
  }

  private toMillis(value: any): number | null {
    if (value === null || value === undefined || value === '') return null;
    if (typeof value?.toMillis === 'function') return value.toMillis();
    if (typeof value?.toDate === 'function') return value.toDate().getTime();
    if (typeof value?._seconds === 'number') return value._seconds * 1000;
    if (value instanceof Date) return value.getTime();

    const parsed = typeof value === 'number' ? value : Date.parse(String(value));
    if (!Number.isFinite(parsed)) return null;
    return typeof value === 'number' && value < 10_000_000_000 ? value * 1000 : parsed;
  }

  private buildUnavailableMessage(lifecycle?: string | null): string {
    if (lifecycle === 'paused') return 'Ticket sales for this event are temporarily paused.';
    if (lifecycle === 'cancelled') return 'This event has been cancelled.';
    if (lifecycle === 'completed') return 'This event has already ended.';
    return 'Tickets are not available for this event right now.';
  }
}
