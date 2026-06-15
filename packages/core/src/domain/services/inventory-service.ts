import { IOrderRepository } from '../repositories/order-repository.js';
import { IEventRepository } from '../repositories/event-repository.js';
// @ts-ignore
import { createReservation, releaseReservation } from '@c1rcle/core/inventory-engine';
// @ts-ignore
import { PUBLIC_LIFECYCLE_STATES } from '@c1rcle/core/events';

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
  }): Promise<any> {
    const { eventId, userId, deviceId, items, workspaceId, queueId } = params;

    const event = await this.eventRepo.getById(eventId, workspaceId || (undefined as any));
    if (!event) throw new Error('Event not found');

    if (!PUBLIC_LIFECYCLE_STATES.includes((event as any).lifecycle)) {
      throw new Error(this.buildUnavailableMessage((event as any).lifecycle));
    }

    const result = await createReservation(event, userId, deviceId, items);
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
        status: 'active',
        createdAt: new Date().toISOString(),
        expiresAt: result.expiresAt,
      });
    }

    return result;
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

  private buildUnavailableMessage(lifecycle?: string | null): string {
    if (lifecycle === 'paused') return 'Ticket sales for this event are temporarily paused.';
    if (lifecycle === 'cancelled') return 'This event has been cancelled.';
    if (lifecycle === 'completed') return 'This event has already ended.';
    return 'Tickets are not available for this event right now.';
  }
}
