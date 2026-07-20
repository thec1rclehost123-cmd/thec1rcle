import {
  __setRazorpayCheckoutForTests,
  discardPendingCheckout,
  processFullCheckout,
} from '../../lib/payments';
import { useCartStore } from '../../store/cartStore';
import {
  cancelOrder,
  cancelReservation,
  getOrder,
  initiateCheckout,
  reserveTickets,
  verifyPayment,
} from '../../lib/api';

const mockFetchUserOrders = jest.fn(async () => undefined);
const mockGetIdToken = jest.fn(async () => 'firebase-token');

jest.mock('../../lib/api', () => ({
  reserveTickets: jest.fn(),
  initiateCheckout: jest.fn(),
  verifyPayment: jest.fn(),
  cancelOrder: jest.fn(),
  cancelReservation: jest.fn(),
  getOrder: jest.fn(),
}));

jest.mock('../../store/ticketsStore', () => ({
  useTicketsStore: {
    getState: jest.fn(() => ({
      fetchUserOrders: mockFetchUserOrders,
    })),
  },
}));

jest.mock('../../lib/firebase', () => ({
  getFirebaseAuth: jest.fn(() => ({
    currentUser: {
      uid: 'user_1',
      getIdToken: mockGetIdToken,
    },
  })),
}));

const mockOpen = jest.fn();

const futureExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();
const baseParams = {
  eventId: 'event_1',
  eventTitle: 'Neon Night',
  items: [{ tierId: 'general', quantity: 2 }],
  userName: 'Aayush',
  userEmail: 'aayush@example.com',
  userPhone: '9999999999',
};

describe('processFullCheckout', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetchUserOrders.mockClear();
    process.env.EXPO_PUBLIC_RAZORPAY_KEY = 'rzp_test_public';
    __setRazorpayCheckoutForTests({ open: mockOpen });
    useCartStore.getState().clearCart();
    (cancelOrder as jest.Mock).mockResolvedValue({ success: true });
    (cancelReservation as jest.Mock).mockResolvedValue({ success: true });
    (getOrder as jest.Mock).mockResolvedValue({ status: 'payment_pending' });
  });

  it('reserves inventory, opens Razorpay, verifies payment, and clears recovery state', async () => {
    (reserveTickets as jest.Mock).mockResolvedValueOnce({
      success: true,
      reservationId: 'res_1',
      items: baseParams.items,
      expiresAt: futureExpiry,
      expiresInSeconds: 600,
    });
    (initiateCheckout as jest.Mock).mockResolvedValueOnce({
      success: true,
      requiresPayment: true,
      order: { id: 'order_1' },
      razorpay: {
        key: 'rzp_test_public',
        orderId: 'rzp_order_1',
        amount: 1500,
        amountPaise: 150000,
        currency: 'INR',
      },
    });
    mockOpen.mockResolvedValueOnce({
      razorpay_order_id: 'rzp_order_1',
      razorpay_payment_id: 'pay_1',
      razorpay_signature: 'sig_1',
    });
    (verifyPayment as jest.Mock).mockResolvedValueOnce({ success: true });

    const statuses: string[] = [];
    const result = await processFullCheckout({
      ...baseParams,
      onStatusChange: (status) => statuses.push(status),
    });

    expect(result).toEqual({ success: true, orderId: 'order_1', requiresPayment: true });
    expect(reserveTickets).toHaveBeenCalledWith(
      { eventId: 'event_1', items: baseParams.items },
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-idempotency-key': expect.stringContaining(':reserve'),
        }),
      }),
    );
    expect(initiateCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ reservationId: 'res_1', userEmail: 'aayush@example.com' }),
      expect.objectContaining({
        headers: expect.objectContaining({
          'x-idempotency-key': expect.stringContaining(':initiate'),
        }),
      }),
    );
    expect(mockOpen).toHaveBeenCalledWith(expect.objectContaining({ order_id: 'rzp_order_1' }));
    expect(verifyPayment).toHaveBeenCalledWith(
      expect.objectContaining({
        orderId: 'order_1',
        razorpay_order_id: 'rzp_order_1',
        razorpay_payment_id: 'pay_1',
        razorpay_signature: 'sig_1',
      }),
      expect.objectContaining({
        headers: expect.objectContaining({ 'x-idempotency-key': 'verify:pay_1' }),
      }),
    );
    expect(statuses).toEqual([
      'reserving',
      'initiating',
      'awaiting_payment',
      'verifying',
      'confirmed',
    ]);
    expect(useCartStore.getState().pendingReservation).toBeNull();
    expect(useCartStore.getState().pendingPaymentOrderId).toBeNull();
    expect(mockFetchUserOrders).toHaveBeenCalledWith();
  });

  it('confirms free orders without opening Razorpay or verifying a payment signature', async () => {
    (reserveTickets as jest.Mock).mockResolvedValueOnce({
      success: true,
      reservationId: 'res_free',
      items: baseParams.items,
      expiresAt: futureExpiry,
      expiresInSeconds: 600,
    });
    (initiateCheckout as jest.Mock).mockResolvedValueOnce({
      success: true,
      requiresPayment: false,
      order: { id: 'order_free' },
    });

    const result = await processFullCheckout(baseParams);

    expect(result).toEqual({ success: true, orderId: 'order_free', requiresPayment: false });
    expect(mockOpen).not.toHaveBeenCalled();
    expect(verifyPayment).not.toHaveBeenCalled();
  });

  it('does not reuse an expired saved reservation', async () => {
    useCartStore.getState().setPendingReservation({
      reservationId: 'expired_res',
      eventId: 'event_1',
      eventTitle: 'Neon Night',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
      items: baseParams.items,
    });
    (reserveTickets as jest.Mock).mockResolvedValueOnce({
      success: true,
      reservationId: 'fresh_res',
      items: baseParams.items,
      expiresAt: futureExpiry,
      expiresInSeconds: 600,
    });
    (initiateCheckout as jest.Mock).mockResolvedValueOnce({
      success: true,
      requiresPayment: false,
      order: { id: 'order_2' },
    });

    await processFullCheckout(baseParams);

    expect(cancelReservation).toHaveBeenCalledWith('expired_res');
    expect(reserveTickets).toHaveBeenCalled();
    expect(initiateCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ reservationId: 'fresh_res' }),
      expect.any(Object),
    );
  });

  it('cancels the pending order and releases inventory when Razorpay is cancelled', async () => {
    (reserveTickets as jest.Mock).mockResolvedValueOnce({
      success: true,
      reservationId: 'res_cancel',
      items: baseParams.items,
      expiresAt: futureExpiry,
      expiresInSeconds: 600,
    });
    (initiateCheckout as jest.Mock).mockResolvedValueOnce({
      success: true,
      requiresPayment: true,
      order: { id: 'order_cancel' },
      razorpay: {
        key: 'rzp_test_public',
        orderId: 'rzp_order_cancel',
        amount: 1500,
        amountPaise: 150000,
        currency: 'INR',
      },
    });
    mockOpen.mockRejectedValueOnce({ code: 'PAYMENT_CANCELLED' });

    const result = await processFullCheckout(baseParams);

    expect(result).toMatchObject({
      success: false,
      orderId: 'order_cancel',
      cancelled: true,
    });
    expect(cancelOrder).toHaveBeenCalledWith('order_cancel');
    expect(useCartStore.getState().pendingReservation).toBeNull();
    expect(useCartStore.getState().pendingPaymentOrderId).toBeNull();
  });

  it('distinguishes a Razorpay payment failure from a user cancellation', async () => {
    (reserveTickets as jest.Mock).mockResolvedValueOnce({
      success: true,
      reservationId: 'res_failed',
      items: baseParams.items,
      expiresAt: futureExpiry,
      expiresInSeconds: 600,
    });
    (initiateCheckout as jest.Mock).mockResolvedValueOnce({
      success: true,
      requiresPayment: true,
      order: { id: 'order_failed' },
      razorpay: {
        key: 'rzp_test_public',
        orderId: 'rzp_order_failed',
        amount: 1500,
        amountPaise: 150000,
        currency: 'INR',
      },
    });
    mockOpen.mockRejectedValueOnce({
      code: 'BAD_REQUEST_ERROR',
      description: 'Payment failed at bank',
    });

    const statuses: string[] = [];
    const result = await processFullCheckout({
      ...baseParams,
      onStatusChange: (status) => statuses.push(status),
    });

    expect(result).toMatchObject({
      success: false,
      orderId: 'order_failed',
      cancelled: false,
      error: 'Payment failed at bank',
    });
    expect(statuses.at(-1)).toBe('failed');
    expect(cancelOrder).toHaveBeenCalledWith('order_failed');
  });

  it('returns a failed result when backend payment verification fails', async () => {
    (reserveTickets as jest.Mock).mockResolvedValueOnce({
      success: true,
      reservationId: 'res_1',
      items: baseParams.items,
      expiresAt: futureExpiry,
      expiresInSeconds: 600,
    });
    (initiateCheckout as jest.Mock).mockResolvedValueOnce({
      success: true,
      requiresPayment: true,
      order: { id: 'order_1' },
      razorpay: {
        key: 'rzp_test_public',
        orderId: 'rzp_order_1',
        amount: 1500,
        amountPaise: 150000,
        currency: 'INR',
      },
    });
    mockOpen.mockResolvedValueOnce({
      razorpay_order_id: 'rzp_order_1',
      razorpay_payment_id: 'pay_1',
      razorpay_signature: 'sig_1',
    });
    (verifyPayment as jest.Mock).mockResolvedValueOnce({ success: false, error: 'Bad signature' });

    const result = await processFullCheckout(baseParams);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Bad signature');
  });

  it('recovers as successful when verification response is lost after server confirmation', async () => {
    (reserveTickets as jest.Mock).mockResolvedValueOnce({
      success: true,
      reservationId: 'res_confirmed',
      items: baseParams.items,
      expiresAt: futureExpiry,
      expiresInSeconds: 600,
    });
    (initiateCheckout as jest.Mock).mockResolvedValueOnce({
      success: true,
      requiresPayment: true,
      order: { id: 'order_confirmed' },
      razorpay: {
        key: 'rzp_test_public',
        orderId: 'rzp_order_confirmed',
        amount: 1500,
        amountPaise: 150000,
        currency: 'INR',
      },
    });
    mockOpen.mockResolvedValueOnce({
      razorpay_order_id: 'rzp_order_confirmed',
      razorpay_payment_id: 'pay_confirmed',
      razorpay_signature: 'sig_confirmed',
    });
    (verifyPayment as jest.Mock).mockRejectedValueOnce(new Error('Response cache failed'));
    (getOrder as jest.Mock).mockResolvedValueOnce({ status: 'confirmed' });

    const result = await processFullCheckout(baseParams);

    expect(result).toEqual({
      success: true,
      orderId: 'order_confirmed',
      requiresPayment: true,
    });
    expect(useCartStore.getState().pendingPaymentOrderId).toBeNull();
    expect(mockFetchUserOrders).toHaveBeenCalled();
  });

  it('clears stale recovery state instead of cancelling an already-confirmed order', async () => {
    useCartStore.getState().setPendingReservation({
      reservationId: 'res_paid',
      eventId: 'event_1',
      eventTitle: 'Neon Night',
      expiresAt: futureExpiry,
      items: baseParams.items,
    });
    useCartStore.getState().setPendingPaymentOrderId('order_paid');
    (getOrder as jest.Mock).mockResolvedValueOnce({ status: 'confirmed' });

    await discardPendingCheckout();

    expect(cancelOrder).not.toHaveBeenCalled();
    expect(useCartStore.getState().pendingPaymentOrderId).toBeNull();
    expect(mockFetchUserOrders).toHaveBeenCalled();
  });

  it('retains local recovery state when server cancellation fails', async () => {
    useCartStore.getState().setPendingReservation({
      reservationId: 'res_still_active',
      eventId: 'event_1',
      eventTitle: 'Neon Night',
      expiresAt: futureExpiry,
      items: baseParams.items,
    });
    (cancelReservation as jest.Mock).mockRejectedValueOnce(new Error('Network unavailable'));

    await expect(discardPendingCheckout()).rejects.toThrow('Network unavailable');

    expect(useCartStore.getState().pendingReservation?.reservationId).toBe('res_still_active');
  });
});
