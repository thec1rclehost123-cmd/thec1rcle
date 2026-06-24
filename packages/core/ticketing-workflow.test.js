import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { verifyRazorpayCheckoutSignature } from './workflows/ticketing.js';

describe('ticketing checkout verification primitives', () => {
  it('verifies Razorpay payment signatures with the official SDK utility', () => {
    const keySecret = 'rzp_test_secret';
    const signature = createHmac('sha256', keySecret).update('order_rzp_1|pay_1').digest('hex');

    expect(
      verifyRazorpayCheckoutSignature({
        razorpayOrderId: 'order_rzp_1',
        razorpayPaymentId: 'pay_1',
        razorpaySignature: signature,
        keySecret,
      }),
    ).toBe(true);

    expect(() =>
      verifyRazorpayCheckoutSignature({
        razorpayOrderId: 'order_rzp_1',
        razorpayPaymentId: 'pay_1',
        razorpaySignature: 'bad_signature',
        keySecret,
      }),
    ).toThrow('Invalid signature');
  });
});
