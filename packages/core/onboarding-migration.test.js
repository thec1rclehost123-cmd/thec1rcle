import { describe, expect, it } from 'vitest';

import { buildOnboardingBootstrap } from './onboarding-service.js';
import {
  buildOnboardingV2ApplyPatch,
  classifyOnboardingV2Migration,
} from './onboarding-migration.js';

const verifiedPhoneAuth = {
  uid: 'user_1',
  phoneNumber: '+919999999999',
  providerData: [{ providerId: 'phone' }],
};

const googleWithoutPhone = {
  uid: 'user_1',
  email: 'member@example.com',
  emailVerified: true,
  providerData: [{ providerId: 'google.com' }],
};

const googleWithPhone = {
  ...googleWithoutPhone,
  phoneNumber: '+919999999999',
};

function canonicalProfile(overrides = {}) {
  return {
    identity: { displayName: 'Aayush', dateOfBirth: '2000-01-01' },
    discoveryProfile: {
      cityId: 'pune',
      cityName: 'Pune',
      vibeTags: ['clubs', 'live_music', 'lounges'],
      intents: ['discover'],
    },
    ...overrides,
  };
}

describe('consumer onboarding v2 migration classifier', () => {
  it('never trusts a Firestore-only phone as verified', () => {
    const result = classifyOnboardingV2Migration({
      userId: 'user_1',
      data: { phone: '+918888888888', phoneNumber: '+918888888888' },
      authRecord: googleWithoutPhone,
    });

    expect(result.firebasePhoneVerified).toBe(false);
    expect(result.currentStage).toBe('phone_required');
    expect(result.cohort).toBe('incomplete_phone_required');
  });

  it('classifies a missing Firebase Auth record as an orphan, even with a stored phone', () => {
    const result = classifyOnboardingV2Migration({
      userId: 'orphan_1',
      data: {
        phone: '+918888888888',
        onboardingComplete: true,
        profileSetupComplete: true,
      },
      authRecord: null,
    });

    expect(result.cohort).toBe('orphaned_firestore_user');
    expect(result.currentStage).toBe('phone_required');
    expect(result.firebasePhoneVerified).toBe(false);
  });

  it('grandfathers a completed legacy user only when Firebase proves the phone', () => {
    const result = classifyOnboardingV2Migration({
      userId: 'user_1',
      data: {
        onboardingComplete: true,
        profileSetupComplete: true,
        displayName: 'Aayush',
      },
      authRecord: googleWithPhone,
    });

    expect(result.cohort).toBe('legacy_complete_grandfathered');
    expect(result.currentStage).toBe('complete');
    expect(result.proposedChanges.consumerOnboarding).toMatchObject({
      completed: true,
      currentStage: 'complete',
      legacyCompletionGrandfathered: true,
      version: 2,
    });
  });

  it('does not grandfather a legacy-complete user without a Firebase phone', () => {
    const result = classifyOnboardingV2Migration({
      userId: 'user_1',
      data: {
        onboardingComplete: true,
        profileSetupComplete: true,
        phone: '+918888888888',
      },
      authRecord: googleWithoutPhone,
    });

    expect(result.cohort).toBe('legacy_complete_phone_required');
    expect(result.currentStage).toBe('phone_required');
    expect(result.proposedChanges.consumerOnboarding.legacyCompletionGrandfathered).toBeUndefined();
  });

  it('does not repurpose a guest-only onboardingComplete flag as consumer completion', () => {
    const result = classifyOnboardingV2Migration({
      userId: 'guest_1',
      data: { onboardingComplete: true, displayName: 'Guest', gender: 'other' },
      authRecord: verifiedPhoneAuth,
    });

    expect(result.legacyComplete).toBe(false);
    expect(result.cohort).not.toBe('legacy_complete_grandfathered');
    expect(result.currentStage).not.toBe('complete');
  });

  it('copies real legacy profile values into canonical compatibility maps', () => {
    const result = classifyOnboardingV2Migration({
      userId: 'user_1',
      data: {
        displayName: ' Aayush ',
        dateOfBirth: '2000-01-01',
        cityId: 'pune',
        city: 'Pune',
        vibeTags: ['clubs', 'live_music', 'lounges'],
        intents: ['discover'],
      },
      authRecord: googleWithPhone,
    });

    expect(result.cohort).toBe('canonical_complete');
    expect(result.proposedChanges.identity).toEqual({
      displayName: 'Aayush',
      dateOfBirth: '2000-01-01',
    });
    expect(result.proposedChanges.discoveryProfile).toMatchObject({
      cityId: 'pune',
      cityName: 'Pune',
      vibeTags: ['clubs', 'live_music', 'lounges'],
      intents: ['discover'],
    });
  });

  it('adds migration version and timestamp only to the apply patch', () => {
    const data = canonicalProfile();
    const classification = classifyOnboardingV2Migration({
      userId: 'user_1',
      data,
      authRecord: googleWithPhone,
    });

    expect(classification.proposedChanges.migrations).toBeUndefined();
    expect(classification.proposedChanges.updatedAt).toBeUndefined();

    const applied = buildOnboardingV2ApplyPatch(classification, data, '2026-07-11T12:00:00.000Z');
    expect(applied.migrations.consumerOnboardingV2).toEqual({
      version: 2,
      migratedAt: '2026-07-11T12:00:00.000Z',
      cohort: 'canonical_complete',
    });
    expect(applied.consumerOnboarding.updatedAt).toBe('2026-07-11T12:00:00.000Z');
  });

  it('is idempotent after the apply marker exists', () => {
    const result = classifyOnboardingV2Migration({
      userId: 'user_1',
      data: {
        ...canonicalProfile(),
        migrations: {
          consumerOnboardingV2: { version: 2, migratedAt: '2026-07-11T12:00:00.000Z' },
        },
      },
      authRecord: verifiedPhoneAuth,
    });

    expect(result.cohort).toBe('already_migrated_v2');
    expect(result.shouldApply).toBe(false);
    expect(result.proposedChanges).toEqual({});
  });

  it('keeps grandfathered users complete at runtime but still enforces Firebase phone authority', () => {
    const migratedData = {
      consumerOnboarding: {
        version: 2,
        completed: true,
        currentStage: 'complete',
        legacyCompletionGrandfathered: true,
      },
    };

    expect(
      buildOnboardingBootstrap('user_1', migratedData, verifiedPhoneAuth).onboarding.currentStage,
    ).toBe('complete');
    expect(
      buildOnboardingBootstrap('user_1', migratedData, googleWithoutPhone).onboarding.currentStage,
    ).toBe('phone_required');
  });
});
