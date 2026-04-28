import { describe, expect, it } from 'vitest';
import { PaymentService } from './src/domain/services/payment-service.js';

class FakeOrderRepository {
    payments = new Map<string, any>();

    async createPaymentRecord(payment: any) {
        this.payments.set(`${payment.orderId}__${payment.razorpayOrderId}`, payment);
    }

    async updatePaymentRecord(orderId: string, razorpayOrderId: string, updates: any) {
        const key = `${orderId}__${razorpayOrderId}`;
        const existing = this.payments.get(key);
        if (!existing) throw new Error('Payment record not found');
        this.payments.set(key, { ...existing, ...updates });
    }

    async getLatestPendingPaymentRecord(orderId: string) {
        return [...this.payments.values()]
            .filter((payment) => payment.orderId === orderId && payment.status === 'initiated')
            .sort((left, right) => Date.parse(String(right.createdAt || 0)) - Date.parse(String(left.createdAt || 0)))[0] || null;
    }
}

describe('PaymentService', () => {
    it('reuses a recent initiated payment record for the same order', async () => {
        const orderRepo = new FakeOrderRepository();
        const service = new PaymentService(orderRepo as any);
        const order = {
            id: 'ord_1',
            totalAmount: 1499,
            workspaceId: 'ws_1',
        };

        const first = await service.prepareRazorpayOrder({
            order: order as any,
            userId: 'user_1',
            config: {
                keyId: '',
                keySecret: '',
                allowMockPayment: true,
            },
        });

        const second = await service.prepareRazorpayOrder({
            order: order as any,
            userId: 'user_1',
            config: {
                keyId: '',
                keySecret: '',
                allowMockPayment: true,
            },
        });

        expect(second).toMatchObject(first);
        expect(orderRepo.payments.size).toBe(1);
    });
});
