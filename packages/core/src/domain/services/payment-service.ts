import { IOrderRepository, Order } from '../repositories/order-repository.js';

export class PaymentService {
    constructor(private orderRepo: IOrderRepository) { }

    async prepareRazorpayOrder(params: {
        order: Order,
        userId: string,
        config: {
            keyId: string;
            keySecret: string;
            allowMockPayment?: boolean;
        }
    }): Promise<any> {
        const { order, userId, config } = params;
        const { keyId, keySecret, allowMockPayment } = config;

        if (!keyId || !keySecret) {
            if (!allowMockPayment) {
                throw new Error('Payment gateway is not configured');
            }

            const razorpayOrderId = `order_mock_${Date.now()}`;
            await this.orderRepo.createPaymentRecord({
                orderId: order.id,
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
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10_000);

        let response: Response;
        try {
            response = await fetch("https://api.razorpay.com/v1/orders", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Basic ${authHeader}`
                },
                body: JSON.stringify({
                    amount: Math.round(order.totalAmount * 100),
                    currency: "INR",
                    receipt: order.id,
                    notes: { orderId: order.id, userId }
                }),
                signal: controller.signal
            });
        } catch (e: any) {
            if (e.name === 'AbortError') throw new Error("Razorpay request timed out after 10s");
            throw e;
        } finally {
            clearTimeout(timeoutId);
        }

        if (!response.ok) {
            const err = await response.json() as any;
            throw new Error(err.error?.description || "Razorpay order failed");
        }

        const rzpOrder = await response.json() as any;

        await this.orderRepo.createPaymentRecord({
            orderId: order.id,
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

    async recordPaymentVerification(orderId: string, razorpayOrderId: string, razorpayPaymentId: string, transaction?: any): Promise<void> {
        await this.orderRepo.updatePaymentRecord(orderId, razorpayOrderId, {
            status: 'verified',
            razorpayPaymentId: razorpayPaymentId,
            verifiedAt: new Date().toISOString()
        }, transaction);
    }
}
