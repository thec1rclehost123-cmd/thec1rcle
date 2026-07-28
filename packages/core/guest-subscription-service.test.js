import { describe, expect, it } from 'vitest';
import {
  FREE_SUBSCRIPTION_LIMITS,
  buildGuestSubscriptionContext,
  getGuestSubscriptionContext,
  resolveGuestSubscription,
} from './guest-subscription-service.js';

function createDb(seed = {}) {
  const records = new Map(Object.entries(seed));
  return {
    collection(name) {
      return {
        doc(id) {
          return {
            async get() {
              const value = records.get(`${name}/${id}`);
              return { exists: value !== undefined, data: () => value };
            },
          };
        },
      };
    },
  };
}

describe('guest subscription service', () => {
  it('keeps free limits server-owned and maps legacy usage counters', () => {
    const context = buildGuestSubscriptionContext(
      {},
      { likes: 4, askOuts: 1 },
      new Date('2026-07-27T12:00:00.000Z'),
    );
    expect(context.subscription).toMatchObject({ tier: 'free', isPremium: false });
    expect(context.limits).toEqual(FREE_SUBSCRIPTION_LIMITS);
    expect(context.usage).toMatchObject({
      date: '2026-07-27',
      likesUsed: 4,
      askOutsUsed: 1,
      timeZone: 'UTC',
    });
  });

  it('fails closed to free when a premium subscription is expired', () => {
    expect(
      resolveGuestSubscription(
        {
          subscription: {
            tier: 'premium',
            status: 'active',
            expiresAt: '2026-07-26T00:00:00.000Z',
          },
        },
        new Date('2026-07-27T12:00:00.000Z'),
      ),
    ).toMatchObject({ tier: 'free', isPremium: false, status: 'expired' });
  });

  it('loads the user and current UTC usage record from Firestore', async () => {
    const db = createDb({
      'users/user_1': {
        subscription: { tier: 'premium', status: 'active' },
      },
      'userDailyLimits/user_1_2026-07-27': { likesUsed: 12, askOutsUsed: 2 },
    });
    const context = await getGuestSubscriptionContext(
      db,
      'user_1',
      new Date('2026-07-27T12:00:00.000Z'),
    );

    expect(context.subscription).toMatchObject({ tier: 'premium', isPremium: true });
    expect(context.limits.likesPerDay).toBeNull();
    expect(context.usage.likesUsed).toBe(12);
  });
});
