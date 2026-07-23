import {
  parseFeatureFlag,
  readFirstRunFeatureFlags,
  shouldEnforceFirstRunV2,
} from '@/lib/featureFlags';
import { sanitizeFirstRunAnalyticsProperties } from '@/lib/firstRunAnalytics';

describe('first-run release controls', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('defaults to the complete v2 journey and supports a one-variable rollback', () => {
    delete process.env.EXPO_PUBLIC_FIRST_RUN_V2_ENABLED;
    delete process.env.EXPO_PUBLIC_ONBOARDING_V2_REQUIRED;
    const defaults = readFirstRunFeatureFlags();
    expect(defaults.firstRunV2Enabled).toBe(true);
    expect(defaults.onboardingV2Required).toBe(true);
    expect(shouldEnforceFirstRunV2(defaults)).toBe(true);

    expect(parseFeatureFlag('off', true)).toBe(false);
    expect(shouldEnforceFirstRunV2({ ...defaults, firstRunV2Enabled: false })).toBe(false);
  });

  it('drops direct and disguised identity, location, credential, and OTP fields', () => {
    const properties = sanitizeFirstRunAnalyticsProperties({
      provider: 'phone',
      stage: 'identity',
      phoneNumber: '+919999999999',
      recovery_email: 'private@example.com',
      dateOfBirth: '2000-01-01',
      latitude: 18.5,
      authToken: 'secret',
      otp_code: '123456',
      displayName: 'Private Person',
    } as any);
    expect(properties).toEqual({ provider: 'phone', stage: 'identity' });
  });

  it('supports deterministic percentage, platform, internal, and hard-disable rollout gates', () => {
    const base = readFirstRunFeatureFlags();
    const partial = { ...base, rolloutPercent: 50, rolloutPlatforms: ['ios'] };
    const first = shouldEnforceFirstRunV2(partial, { subjectId: 'opaque-user-1', platform: 'ios' });
    expect(shouldEnforceFirstRunV2(partial, { subjectId: 'opaque-user-1', platform: 'ios' })).toBe(
      first,
    );
    expect(
      shouldEnforceFirstRunV2(partial, { subjectId: 'opaque-user-1', platform: 'android' }),
    ).toBe(false);
    expect(
      shouldEnforceFirstRunV2(
        { ...partial, rolloutPercent: 0 },
        { internalAccount: true, platform: 'android' },
      ),
    ).toBe(true);
    expect(
      shouldEnforceFirstRunV2({ ...partial, firstRunV2Enabled: false }, { internalAccount: true }),
    ).toBe(false);
  });

  it('allows only bounded rounded performance duration values', () => {
    expect(sanitizeFirstRunAnalyticsProperties({ metric: 'auth_sync', duration_ms: 10.6 })).toEqual(
      {
        metric: 'auth_sync',
        duration_ms: 11,
      },
    );
    expect(
      sanitizeFirstRunAnalyticsProperties({ metric: 'auth_sync', duration_ms: 999_999 }),
    ).toEqual({
      metric: 'auth_sync',
      duration_ms: 600_000,
    });
  });
});
