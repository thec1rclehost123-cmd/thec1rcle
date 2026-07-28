import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  buildCoverWalletDocumentsForOrder,
  finalizationArtifactMatches,
  signTicketJwt,
  verifyRazorpayCheckoutSignature,
} from './workflows/ticketing.js';

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

  it('builds one deterministic Cover wallet for every purchased admission unit', () => {
    const issuedAt = '2026-07-27T12:00:00.000Z';
    const wallets = buildCoverWalletDocumentsForOrder(
      {
        id: 'order_cover_1',
        eventId: 'event_cover_1',
        venueId: 'venue_1',
        userId: 'user_1',
        createdAt: issuedAt,
        coverChargeTermsAcceptedAt: issuedAt,
        tickets: [
          {
            ticketId: 'tier_cover',
            quantity: 2,
            coverChargeConfig: {
              enabled: true,
              walletAmountPaise: 50_000,
              terminationHour: 5,
              terminationPolicy: 'forfeit',
              partialRefundPercent: 0,
              presetItems: [],
            },
          },
          {
            ticketId: 'tier_standard',
            quantity: 3,
          },
        ],
      },
      {
        id: 'event_cover_1',
        venueId: 'venue_1',
        startAt: '2026-07-27T22:00:00+05:30',
        timezoneOffset: '+05:30',
      },
      issuedAt,
    );

    expect(wallets).toHaveLength(2);
    expect(wallets.map((wallet) => wallet.unitIndex)).toEqual([1, 2]);
    expect(new Set(wallets.map((wallet) => wallet.id)).size).toBe(2);
    expect(wallets).toEqual([
      expect.objectContaining({
        orderId: 'order_cover_1',
        eventId: 'event_cover_1',
        venueId: 'venue_1',
        userId: 'user_1',
        tierId: 'tier_cover',
        openingBalancePaise: 50_000,
        currentBalancePaise: 50_000,
        state: 'ACTIVE',
      }),
      expect.objectContaining({
        orderId: 'order_cover_1',
        eventId: 'event_cover_1',
        venueId: 'venue_1',
        userId: 'user_1',
        tierId: 'tier_cover',
        openingBalancePaise: 50_000,
        currentBalancePaise: 50_000,
        state: 'ACTIVE',
      }),
    ]);
  });

  it('fails immutable Cover Wallet conflicts while allowing legitimate mutable state changes', () => {
    const expected = {
      id: 'wallet_1',
      orderId: 'order_1',
      eventId: 'event_1',
      venueId: 'venue_1',
      userId: 'original_owner',
      tierId: 'cover',
      unitIndex: 1,
      schemaVersion: 2,
      terminationAtMs: 1_785_217_400_000,
      openingBalancePaise: 50_000,
      currentBalancePaise: 50_000,
      state: 'ACTIVE',
      rules: { currency: 'INR', terminationPolicy: 'forfeit' },
      termsAcceptedAt: '2026-07-27T12:00:00.000Z',
      termsVersion: '1.0',
      createdBy: 'checkout_service',
    };

    expect(
      finalizationArtifactMatches(
        'coverWallet',
        {
          ...expected,
          userId: 'transferred_owner',
          currentBalancePaise: 25_000,
          state: 'FROZEN',
        },
        expected,
      ),
    ).toBe(true);
    expect(
      finalizationArtifactMatches(
        'coverWallet',
        { ...expected, openingBalancePaise: 500_000 },
        expected,
      ),
    ).toBe(false);
    expect(
      finalizationArtifactMatches('coverWallet', { ...expected, venueId: 'other_venue' }, expected),
    ).toBe(false);
  });
});
