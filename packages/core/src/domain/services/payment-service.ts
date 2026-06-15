import { IOrderRepository, Order, PaymentRecord } from '../repositories/order-repository.js';

const PAYMENT_ORDER_REUSE_WINDOW_MS = 30 * 60 * 1000;

export class PaymentService {
  constructor(private orderRepo: IOrderRepository) {}

  async prepareRazorpayOrder(params: {
    order: Order;
    userId: string;
    config: {
      keyId: string;
      keySecret: string;
      allowMockPayment?: boolean;
    };
  }): Promise<any> {
    const { order, userId, config } = params;
    const { keyId, keySecret, allowMockPayment } = config;
    const reusableRecord = await this.orderRepo.getLatestPendingPaymentRecord(order.id);

    if (this.canReusePaymentRecord(reusableRecord, order, userId)) {
      const isMockOrder = String(reusableRecord!.razorpayOrderId || '').startsWith('order_mock_');
      if (isMockOrder && !allowMockPayment) {
        throw new Error('Mock payments are disabled');
      }
      if (!isMockOrder && (!keyId || !keySecret)) {
        throw new Error('Payment gateway is not configured');
      }

      return {
        razorpayOrderId: reusableRecord!.razorpayOrderId,
        amount: reusableRecord!.amount,
        currency: 'INR',
        key: isMockOrder ? 'rzp_test_DEVELOPMENT' : keyId,
      };
    }

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
        createdAt: new Date().toISOString(),
      });
      return {
        razorpayOrderId,
        amount: order.totalAmount,
        currency: 'INR',
        key: 'rzp_test_DEVELOPMENT',
      };
    }

    const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    let response: Response;
    try {
      response = await fetch('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${authHeader}`,
        },
        body: JSON.stringify({
          amount: Math.round(order.totalAmount * 100),
          currency: 'INR',
          receipt: order.id,
          notes: { orderId: order.id, userId },
        }),
        signal: controller.signal,
      });
    } catch (e: any) {
      if (e.name === 'AbortError') throw new Error('Razorpay request timed out after 10s');
      throw e;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const err = (await response.json()) as any;
      throw new Error(err.error?.description || 'Razorpay order failed');
    }

    const rzpOrder = (await response.json()) as any;

    await this.orderRepo.createPaymentRecord({
      orderId: order.id,
      razorpayOrderId: rzpOrder.id,
      workspaceId: order.workspaceId || null,
      amount: order.totalAmount,
      status: 'initiated',
      userId,
      createdAt: new Date().toISOString(),
    });

    return {
      razorpayOrderId: rzpOrder.id,
      amount: order.totalAmount,
      currency: 'INR',
      key: keyId,
    };
  }

  async recordPaymentVerification(
    orderId: string,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    transaction?: any,
  ): Promise<void> {
    await this.orderRepo.updatePaymentRecord(
      orderId,
      razorpayOrderId,
      {
        status: 'verified',
        razorpayPaymentId: razorpayPaymentId,
        verifiedAt: new Date().toISOString(),
      },
      transaction,
    );
  }

  async recordPaymentFailure(
    orderId: string,
    razorpayOrderId: string,
    razorpayPaymentId?: string | null,
  ): Promise<void> {
    await this.orderRepo
      .updatePaymentRecord(orderId, razorpayOrderId, {
        status: 'failed',
        razorpayPaymentId: razorpayPaymentId || undefined,
        failedAt: new Date().toISOString(),
      })
      .catch(() => undefined);
  }

  async validateGatewayPayment(params: {
    paymentRecord: PaymentRecord;
    razorpayOrderId: string;
    razorpayPaymentId: string;
    config: {
      keyId?: string;
      keySecret?: string;
      allowMockPayment?: boolean;
    };
  }): Promise<any> {
    const { paymentRecord, razorpayOrderId, razorpayPaymentId, config } = params;
    const { keyId, keySecret, allowMockPayment } = config;
    const isMockOrder = String(razorpayOrderId || '').startsWith('order_mock_');
    const isMockPayment = String(razorpayPaymentId || '').startsWith('pay_mock_');

    if (isMockOrder || isMockPayment) {
      if (!allowMockPayment) {
        throw new Error('Mock payments are disabled');
      }
      return {
        id: razorpayPaymentId,
        order_id: razorpayOrderId,
        amount: Math.round(Number(paymentRecord.amount || 0) * 100),
        currency: 'INR',
        status: 'captured',
        captured: true,
      };
    }

    if (!keyId || !keySecret) {
      throw new Error('Payment verification is not configured');
    }

    const authHeader = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);

    let response: Response;
    try {
      response = await fetch(
        `https://api.razorpay.com/v1/payments/${encodeURIComponent(razorpayPaymentId)}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Basic ${authHeader}`,
          },
          signal: controller.signal,
        },
      );
    } catch (e: any) {
      if (e.name === 'AbortError') throw new Error('Razorpay payment lookup timed out after 10s');
      throw e;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const err = (await response.json().catch(() => ({}) as any)) as any;
      throw new Error(err.error?.description || 'Unable to verify payment with Razorpay');
    }

    const payment = (await response.json()) as any;
    const expectedAmountPaise = Math.round(Number(paymentRecord.amount || 0) * 100);
    const paymentStatus = String(payment?.status || '').toLowerCase();
    const paymentCurrency = String(payment?.currency || '').toUpperCase();

    if (payment?.order_id !== razorpayOrderId) {
      throw new Error('Payment does not belong to this Razorpay order');
    }
    if (Number(payment?.amount || 0) !== expectedAmountPaise) {
      throw new Error('Payment amount mismatch');
    }
    if (paymentCurrency && paymentCurrency !== 'INR') {
      throw new Error('Payment currency mismatch');
    }
    if (!['authorized', 'captured'].includes(paymentStatus)) {
      throw new Error('Payment is not successful');
    }

    return payment;
  }

  private canReusePaymentRecord(payment: any, order: Order, userId: string): boolean {
    if (!payment) return false;
    if (payment.status !== 'initiated') return false;
    if (payment.userId !== userId) return false;
    if (Number(payment.amount) !== Number(order.totalAmount)) return false;

    const createdAtMs = Date.parse(String(payment.createdAt || ''));
    if (!Number.isFinite(createdAtMs)) return false;

    return Date.now() - createdAtMs <= PAYMENT_ORDER_REUSE_WINDOW_MS;
  }
}
