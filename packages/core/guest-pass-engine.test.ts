import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./order-engine.js', () => ({
  getOrderById: vi.fn(),
}));

import { getOrderById } from './order-engine.js';
import { buildGuestPass } from './guest-pass-engine.js';

function entitlementDb(entitlements: any[] = []) {
  const snapshot = {
    docs: entitlements.map((entitlement, index) => ({
      id: entitlement.id || `ent_${index + 1}`,
      data: () => entitlement,
    })),
  };
  const query: any = {
    where: vi.fn(() => query),
    limit: vi.fn(() => query),
    get: vi.fn(async () => snapshot),
  };
  return {
    collection: vi.fn(() => query),
    query,
  };
}

describe('guest pass authorization and provider configuration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getOrderById).mockResolvedValue({
      id: 'ord_1',
      userId: 'buyer_1',
      eventId: 'event_1',
    } as any);
  });

  it('rejects missing authentication without exposing whether the order exists', async () => {
    const result = await buildGuestPass({ orderId: 'ord_1', platform: 'apple', env: {} });

    expect(result).toMatchObject({
      statusCode: 401,
      body: { success: false, code: 'unauthorized' },
    });
    expect(getOrderById).not.toHaveBeenCalled();
  });

  it('denies a user who owns neither the order nor an active entitlement', async () => {
    const db = entitlementDb([
      { orderId: 'ord_1', ownerUserId: 'user_2', eventId: 'event_1', state: 'REVOKED' },
    ]);

    const result = await buildGuestPass({
      orderId: 'ord_1',
      platform: 'google',
      userId: 'user_2',
      db,
      env: {
        GOOGLE_WALLET_ENABLED: 'true',
        GOOGLE_WALLET_SAVE_URL_TEMPLATE: 'https://wallet.example/{orderId}',
      },
    });

    expect(result).toMatchObject({
      statusCode: 403,
      body: { success: false, code: 'forbidden' },
    });
    expect(db.query.where).toHaveBeenNthCalledWith(1, 'orderId', '==', 'ord_1');
  });

  it('denies the historical order buyer after active entitlements move to another user', async () => {
    const db = entitlementDb([
      { orderId: 'ord_1', ownerUserId: 'recipient_1', eventId: 'event_1', state: 'ACTIVE' },
    ]);

    const result = await buildGuestPass({
      orderId: 'ord_1',
      platform: 'apple',
      userId: 'buyer_1',
      db,
      env: {
        APPLE_WALLET_ENABLED: 'true',
        APPLE_WALLET_PASS_URL_TEMPLATE: 'https://wallet.example/{orderId}',
      },
    });

    expect(result).toMatchObject({
      statusCode: 403,
      body: { success: false, code: 'forbidden' },
    });
  });

  it('allows an active entitlement owner and returns only the configured Google save URL', async () => {
    const db = entitlementDb([
      { orderId: 'ord_1', ownerUserId: 'user_2', eventId: 'event_1', state: 'ACTIVE' },
    ]);

    const result = await buildGuestPass({
      orderId: 'ord_1',
      platform: 'google',
      userId: 'user_2',
      db,
      env: {
        GOOGLE_WALLET_ENABLED: 'true',
        GOOGLE_WALLET_SAVE_URL_TEMPLATE:
          'https://wallet.example/save?order={orderId}&user={userId}',
      },
    });

    expect(result).toEqual({
      statusCode: 200,
      body: {
        success: true,
        provider: 'google',
        saveUrl: 'https://wallet.example/save?order=ord_1&user=user_2',
      },
    });
  });

  it('keeps providers disabled even when a URL template exists until explicitly enabled', async () => {
    const result = await buildGuestPass({
      orderId: 'ord_1',
      platform: 'apple',
      userId: 'buyer_1',
      env: { APPLE_WALLET_PASS_URL_TEMPLATE: 'https://wallet.example/{orderId}' },
    });

    expect(result).toMatchObject({
      statusCode: 503,
      body: { success: false, code: 'feature_disabled', provider: 'apple', fallback: 'pdf' },
    });
  });

  it('rejects an enabled provider without an HTTPS artifact URL', async () => {
    const result = await buildGuestPass({
      orderId: 'ord_1',
      platform: 'apple',
      userId: 'buyer_1',
      env: {
        APPLE_WALLET_ENABLED: 'true',
        APPLE_WALLET_PASS_URL_TEMPLATE: 'http://wallet.example/{orderId}',
      },
    });

    expect(result).toMatchObject({
      statusCode: 503,
      body: { success: false, code: 'invalid_configuration', provider: 'apple' },
    });
  });

  it('redirects an order owner only to an explicitly enabled HTTPS Apple pass service', async () => {
    const result = await buildGuestPass({
      orderId: 'ord_1',
      platform: 'apple',
      userId: 'buyer_1',
      env: {
        APPLE_WALLET_ENABLED: 'true',
        APPLE_WALLET_PASS_URL_TEMPLATE:
          'https://wallet.example/pass?order={orderId}&event={eventId}&user={userId}',
      },
    });

    expect(result).toEqual({
      statusCode: 302,
      headers: {
        Location: 'https://wallet.example/pass?order=ord_1&event=event_1&user=buyer_1',
      },
      body: null,
    });
  });
});
