import Razorpay from 'razorpay';
import { IOrderRepository, Order, PaymentRecord } from '../repositories/order-repository.js';

const PAYMENT_ORDER_REUSE_WINDOW_MS = 30 * 60 * 1000;
const RAZORPAY_REQUEST_TIMEOUT_MS = 10_000;

function withTimeout<T>(promise: Promise<T>, message: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(message)), RAZORPAY_REQUEST_TIMEOUT_MS);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timeoutId));
}

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

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

    let rzpOrder: any;
    try {
      rzpOrder = await withTimeout(
        razorpay.orders.create({
          amount: Math.round(order.totalAmount * 100),
          currency: 'INR',
          receipt: order.id,
          notes: { orderId: order.id, userId },
        }),
        'Razorpay request timed out after 10s',
      );
    } catch (e: any) {
      throw new Error(e?.error?.description || e?.message || 'Razorpay order failed');
    }

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

    const razorpay = new Razorpay({ key_id: keyId, key_secret: keySecret });

    let payment: any;
    try {
      payment = await withTimeout(
        razorpay.payments.fetch(razorpayPaymentId),
        'Razorpay payment lookup timed out after 10s',
      );
    } catch (e: any) {
      throw new Error(
        e?.error?.description || e?.message || 'Unable to verify payment with Razorpay',
      );
    }

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
