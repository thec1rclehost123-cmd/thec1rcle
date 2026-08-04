import { describe, expect, it } from 'vitest';

describe('@c1rcle/core/user-service package contract', () => {
  it('exposes the runtime functions used by Gateway authentication and profile routes', async () => {
    const service = await import('@c1rcle/core/user-service');

    expect(service.syncAuthUser).toBeTypeOf('function');
    expect(service.getPrivateProfile).toBeTypeOf('function');
    expect(service.updateProfile).toBeTypeOf('function');
    expect(service.blockUser).toBeTypeOf('function');
  });

  it('exposes the canonical onboarding and subscription services used by Mobile', async () => {
    const [onboarding, subscription] = await Promise.all([
      import('@c1rcle/core/guest-onboarding-service'),
      import('@c1rcle/core/guest-subscription-service'),
    ]);

    expect(onboarding.getGuestOnboardingSnapshot).toBeTypeOf('function');
    expect(onboarding.completeGuestOnboarding).toBeTypeOf('function');
    expect(subscription.getGuestSubscriptionContext).toBeTypeOf('function');
    expect(subscription.FREE_SUBSCRIPTION_LIMITS.likesPerDay).toBe(10);
  });
});
