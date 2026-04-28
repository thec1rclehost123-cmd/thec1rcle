import { IOrderRepository } from '../repositories/order-repository.js';
import { IEventRepository } from '../repositories/event-repository.js';

export class CancellationService {
    private readonly CANCEL_WINDOW_HOURS = 48;
    private readonly FREE_CANCELLATION_HOURS = 24;

    constructor(
        private orderRepo: IOrderRepository,
        private eventRepo: IEventRepository
    ) { }

    async getDecision(order: any, event: any): Promise<any> {
        const now = new Date();
        let canCancel = true;
        let refundPercentage = 100;
        let reason: string | null = null;

        if (order.status === 'cancelled') {
            return { canCancel: false, reason: 'Order is already cancelled', refundPercentage: 0 };
        }

        if (event) {
            const eventStart = new Date(event.startDate || event.date);
            const hoursUntilEvent = (eventStart.getTime() - now.getTime()) / (1000 * 60 * 60);

            if (hoursUntilEvent <= 0) {
                canCancel = false;
                reason = 'Event has already started';
            } else if (hoursUntilEvent < this.CANCEL_WINDOW_HOURS) {
                refundPercentage = 75;
            }

            const policySource = order.cancellationPolicySnapshot || {
                policy: event.cancellationPolicy,
                refundPercent: event.cancellationRefundPercent,
            };

            if (policySource.policy === 'no_refund') {
                refundPercentage = 0;
            } else if (policySource.policy === 'partial') {
                refundPercentage = policySource.refundPercent || 50;
            }

            const purchaseDate = new Date(order.createdAt);
            const hoursSincePurchase = (now.getTime() - purchaseDate.getTime()) / (1000 * 60 * 60);
            if (hoursSincePurchase <= this.FREE_CANCELLATION_HOURS) {
                refundPercentage = 100;
            }
        }

        return {
            canCancel,
            reason,
            refundPercentage,
            refundAmount: Math.round((Number(order.totalAmount || 0) * (refundPercentage / 100)) * 100) / 100,
            orderTotal: Number(order.totalAmount || 0),
        };
    }

    async cancel(params: {
        order: any;
        event: any;
        reason?: string;
        cancelledBy: string;
        cancelledByType?: string;
        refundPayment?: (params: any) => Promise<any>;
    }): Promise<any> {
        const { order, event, cancelledBy, cancelledByType = 'guest', refundPayment } = params;
        const decision = await this.getDecision(order, event);

        if (!decision.canCancel) {
            throw new Error(decision.reason || 'Cancellation not allowed');
        }

        let refundResult: any = null;
        if (decision.refundPercentage > 0 && refundPayment) {
            refundResult = await refundPayment({
                orderId: order.id,
                refundAmount: decision.refundAmount,
                reason: params.reason
            });
        }

        const now = new Date().toISOString();
        await this.orderRepo.updateOrder(order.id, {
            status: 'cancelled',
            cancelledAt: now,
            cancellationReason: params.reason || 'User requested',
            cancelledBy,
            cancelledByType,
            refundPercentage: decision.refundPercentage,
            refundStatus: refundResult ? 'processing' : (decision.refundPercentage === 0 ? 'not_applicable' : 'pending'),
            updatedAt: now,
        }, order.isRSVP);

        return { success: true, decision, refundResult };
    }
}
