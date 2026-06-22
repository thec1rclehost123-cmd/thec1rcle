import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { signTicketJwt, verifyRazorpayCheckoutSignature } from './workflows/ticketing.js';

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

  it('generates a signed JWT string for ticket QR payloads', () => {
    const jwt = signTicketJwt(
      {
        iss: 'the-c1rcle',
        aud: 'c1rcle-scanner',
        typ: 'ticket',
        sub: 'ticket_1',
        iat: 1,
        exp: 2,
      },
      'test_qr_secret',
    );

    const parts = jwt.split('.');
    expect(parts).toHaveLength(3);
    expect(parts[0]).not.toContain('=');
    expect(parts[1]).not.toContain('=');
    expect(parts[2]).not.toContain('=');
  });
});
