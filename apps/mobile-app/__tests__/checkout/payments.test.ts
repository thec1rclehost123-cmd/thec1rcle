import { __setRazorpayCheckoutForTests, processFullCheckout } from '../../lib/payments';
import { useCartStore } from '../../store/cartStore';
import { useAuthStore } from '../../store/authStore';
import { cancelReservation, initiateCheckout, reserveTickets, verifyPayment } from '../../lib/api';

jest.mock('../../lib/api', () => ({
  reserveTickets: jest.fn(),
  initiateCheckout: jest.fn(),
  verifyPayment: jest.fn(),
  cancelReservation: jest.fn().mockResolvedValue({ success: true }),
  cancelOrder: jest.fn().mockResolvedValue({ success: true }),
  getOrder: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../lib/firebase', () => ({
  getFirebaseAuth: () => ({
    currentUser: {
      uid: 'user_1',
      email: 'aayush@example.com',
      getIdToken: jest.fn().mockResolvedValue('token_1'),
    },
  }),
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
    process.env.EXPO_PUBLIC_RAZORPAY_KEY = 'rzp_test_public';
    __setRazorpayCheckoutForTests({ open: mockOpen });
    useCartStore.getState().clearCart();
    useAuthStore.setState({ user: { uid: 'user_1', email: 'aayush@example.com' } as any });
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
        amount: 150000,
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

  it('reuses the screen-owned idempotency key across reserve and initiate phases', async () => {
    (reserveTickets as jest.Mock).mockResolvedValueOnce({
      success: true,
      reservationId: 'res_cached_key',
      items: baseParams.items,
      expiresAt: futureExpiry,
      expiresInSeconds: 600,
    });
    (initiateCheckout as jest.Mock).mockResolvedValueOnce({
      success: true,
      requiresPayment: false,
      order: { id: 'order_cached_key' },
    });

    await processFullCheckout({ ...baseParams, idempotencyKey: 'checkout-session-1' });

    expect(reserveTickets).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        headers: { 'x-idempotency-key': 'checkout-session-1::reserve' },
      }),
    );
    expect(initiateCheckout).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        headers: { 'x-idempotency-key': 'checkout-session-1::initiate' },
      }),
    );
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

    expect(reserveTickets).toHaveBeenCalled();
    expect(initiateCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ reservationId: 'fresh_res' }),
      expect.any(Object),
    );
  });

  it('drops a foreign expired local reservation after the Gateway denies cancellation', async () => {
    useCartStore.getState().setPendingReservation({
      reservationId: 'foreign_expired_res',
      eventId: 'event_1',
      eventTitle: 'Neon Night',
      expiresAt: new Date(Date.now() - 1000).toISOString(),
      items: baseParams.items,
    });
    (cancelReservation as jest.Mock).mockRejectedValueOnce(
      Object.assign(new Error('Forbidden: Not your reservation'), { status: 403 }),
    );
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
      order: { id: 'order_3' },
    });

    const result = await processFullCheckout(baseParams);

    expect(result.success).toBe(true);
    expect(reserveTickets).toHaveBeenCalled();
    expect(initiateCheckout).toHaveBeenCalledWith(
      expect.objectContaining({ reservationId: 'fresh_res' }),
      expect.any(Object),
    );
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
        amount: 150000,
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
});
