import { test, expect } from 'vitest';

import { buildOrderPayload, normalizeOrderSearchPrefix, validateOrder } from './order-engine.js';

test('validateOrder rejects gender-mismatched buyers for female-only tiers', async () => {
  const result = await validateOrder(
    {
      tickets: [{ id: 'ladies', name: 'Ladies Entry', entryType: 'female' }],
    },
    [{ ticketId: 'ladies', quantity: 1 }],
    {
      existingTicketCount: 0,
      hasExistingRSVP: false,
      userGender: 'male',
    },
  );

  expect(result.success).toBe(false);
  expect(result.error).toMatch(/restricted to female attendees only/i);
});

test('validateOrder allows matching buyers for female-only tiers', async () => {
  const result = await validateOrder(
    {
      tickets: [{ id: 'ladies', name: 'Ladies Entry', entryType: 'female' }],
    },
    [{ ticketId: 'ladies', quantity: 1 }],
    {
      existingTicketCount: 0,
      hasExistingRSVP: false,
      userGender: 'female',
    },
  );

  expect(result.success).toBe(true);
});

test('buildOrderPayload persists the authoritative Cover Wallet liability snapshot', () => {
  const order = buildOrderPayload({
    reservation: { id: 'reservation-1', queueId: null },
    event: {
      id: 'event-1',
      title: 'Cover Event',
      hostId: 'host-1',
      venueId: 'venue-1',
      currency: 'INR',
    },
    pricing: {
      items: [
        {
          tierId: 'cover-tier',
          tierName: 'Cover Package',
          quantity: 2,
          unitPrice: 999,
          subtotal: 1998,
          entryType: 'cover',
          coverChargeConfig: { enabled: true, walletAmountPaise: 50_000 },
        },
      ],
      subtotal: 1998,
      discountTotal: 0,
      discounts: [],
      fees: { total: 176.82, gst: 26.97 },
      grandTotal: 2174.82,
      coverCreditLiabilityPaise: 100_000,
      isFree: false,
      currency: 'INR',
    },
    user: { id: 'user-1', name: 'QA Guest', email: 'qa@test.c1rcle.com' },
    financialAttribution: {
      venueSharePaise: 100_000,
      hostPayoutPaise: 99_800,
      venueRule: { source: 'event_financial_split_rules' },
    },
  });

  expect(order.coverCreditLiabilityPaise).toBe(100_000);
  expect(order.tickets[0].coverChargeConfig.walletAmountPaise).toBe(50_000);
  expect(order.searchPrefixes).toEqual(
    expect.arrayContaining([normalizeOrderSearchPrefix(order.id), 'qa', 'qa@', 'cover', 'package']),
  );
});

test('buildOrderPayload persists a fail-closed partner updates consent snapshot', () => {
  const baseParams = {
    reservation: { id: 'reservation-1', queueId: null },
    event: {
      id: 'event-1',
      title: 'Consent Event',
      hostId: 'host-1',
      venueId: 'venue-1',
      currency: 'INR',
    },
    pricing: {
      items: [
        { tierId: 'general', tierName: 'General', quantity: 1, unitPrice: 499, subtotal: 499 },
      ],
      subtotal: 499,
      discountTotal: 0,
      discounts: [],
      fees: { total: 0, gst: 0 },
      grandTotal: 499,
      isFree: false,
      currency: 'INR',
    },
    user: { id: 'user-1', name: 'QA Guest', email: 'qa@test.c1rcle.com' },
  };

  expect(buildOrderPayload(baseParams).marketingConsent).toMatchObject({
    allowPlatformMessages: false,
    allowDirectContactShare: false,
    consentStatement: 'checkout_partner_updates_v1',
  });
  expect(
    buildOrderPayload({ ...baseParams, hostUpdatesOptIn: true }).marketingConsent,
  ).toMatchObject({
    allowPlatformMessages: true,
    allowDirectContactShare: false,
  });
});
