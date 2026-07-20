import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_MIN_ACCOUNT_AGE,
  EMAIL_PROMPT_STATUSES,
  MAX_NIGHTLIFE_TASTES,
  MAX_USER_INTENTS,
  MIN_CONFIGURABLE_ACCOUNT_AGE,
  MIN_NIGHTLIFE_TASTES,
  MIN_USER_INTENTS,
  NIGHTLIFE_TASTES,
  ONBOARDING_V2_VERSION,
  USER_INTENTS,
} from '@c1rcle/types';

import {
  buildOnboardingBootstrap,
  completeOnboarding,
  onboardingConstants,
  recordEmailPrompt,
  syncOnboardingAuthState,
  updateOnboardingCity,
  updateOnboardingPreferences,
} from './onboarding-service.js';

function makeDb(initial) {
  let data = structuredClone(initial);
  const ref = {
    id: initial.uid,
    get: vi.fn(async () => ({ exists: true, data: () => structuredClone(data) })),
    set: vi.fn(async (patch, options) => {
      data = options?.merge ? { ...data, ...structuredClone(patch) } : structuredClone(patch);
    }),
  };
  const db = {
    collection: vi.fn(() => ({ doc: vi.fn(() => ref) })),
    runTransaction: vi.fn(async (handler) =>
      handler({
        get: async () => ({ exists: true, data: () => structuredClone(data) }),
        set: (_ref, patch) => {
          data = { ...data, ...structuredClone(patch) };
        },
      }),
    ),
  };
  return { db, read: () => data };
}

const googleUser = {
  uid: 'user_1',
  email: 'member@example.com',
  emailVerified: true,
  providerData: [{ providerId: 'google.com' }],
};

const phoneUser = {
  uid: 'user_1',
  phoneNumber: '+919999999999',
  providerData: [{ providerId: 'phone' }],
};

describe('consumer onboarding v2', () => {
  it('uses the shared onboarding product contract without local drift', () => {
    expect(onboardingConstants).toEqual({
      version: ONBOARDING_V2_VERSION,
      minimumTastes: MIN_NIGHTLIFE_TASTES,
      maximumTastes: MAX_NIGHTLIFE_TASTES,
      minimumIntents: MIN_USER_INTENTS,
      maximumIntents: MAX_USER_INTENTS,
      defaultMinimumAccountAge: DEFAULT_MIN_ACCOUNT_AGE,
      minimumConfigurableAccountAge: MIN_CONFIGURABLE_ACCOUNT_AGE,
      validTastes: [...NIGHTLIFE_TASTES],
      validIntents: [...USER_INTENTS],
      emailPromptStatuses: [...EMAIL_PROMPT_STATUSES],
    });
  });

  it('does not accept a stale Firestore phone as verified Firebase identity', () => {
    const result = buildOnboardingBootstrap(
      'user_1',
      { uid: 'user_1', phone: '+918888888888', phoneNumber: '+918888888888' },
      googleUser,
    );

    expect(result.identity.phoneVerified).toBe(false);
    expect(result.identity.phoneNumberE164).toBeNull();
    expect(result.onboarding.currentStage).toBe('phone_required');
  });

  it('requires the optional email decision only for phone-first accounts', () => {
    const pending = buildOnboardingBootstrap('user_1', { uid: 'user_1' }, phoneUser);
    const skipped = buildOnboardingBootstrap(
      'user_1',
      { uid: 'user_1', consumerOnboarding: { emailPromptStatus: 'skipped' } },
      phoneUser,
    );

    expect(pending.onboarding.currentStage).toBe('email_optional');
    expect(skipped.onboarding.currentStage).toBe('identity');
  });

  it('derives pending and verified email states from Firebase identity', () => {
    const pending = buildOnboardingBootstrap(
      'user_1',
      { uid: 'user_1' },
      {
        ...phoneUser,
        email: 'member@example.com',
        emailVerified: false,
      },
    );
    const verified = buildOnboardingBootstrap(
      'user_1',
      { uid: 'user_1' },
      {
        ...phoneUser,
        email: 'member@example.com',
        emailVerified: true,
      },
    );

    expect(pending.onboarding).toMatchObject({
      currentStage: 'identity',
      emailPromptStatus: 'pending_verification',
    });
    expect(verified.onboarding).toMatchObject({
      currentStage: 'identity',
      emailPromptStatus: 'verified',
    });
  });

  it('persists shown and skipped decisions but derives verification states from Firebase', async () => {
    const shown = makeDb({ uid: 'user_1' });
    await recordEmailPrompt(shown.db, 'user_1', 'shown');
    expect(shown.read().consumerOnboarding.emailPromptStatus).toBe('shown');

    const skipped = makeDb({ uid: 'user_1' });
    await recordEmailPrompt(skipped.db, 'user_1', 'skipped');
    expect(skipped.read().consumerOnboarding.emailPromptStatus).toBe('skipped');

    await expect(recordEmailPrompt(skipped.db, 'user_1', 'verified')).rejects.toMatchObject({
      code: 'INVALID_EMAIL_PROMPT_STATUS',
    });
  });

  it('derives complete only from verified phone plus canonical consumer data', () => {
    const result = buildOnboardingBootstrap(
      'user_1',
      {
        uid: 'user_1',
        identity: { displayName: 'Aayush', dateOfBirth: '2000-01-01' },
        discoveryProfile: {
          cityId: 'pune',
          cityName: 'Pune',
          vibeTags: ['clubs', 'live_music', 'lounges'],
          intents: ['discover'],
        },
      },
      { ...googleUser, phoneNumber: '+919999999999' },
    );

    expect(result.onboarding.currentStage).toBe('complete');
    expect(result.onboarding.minimumAccountAge).toBe(18);
    expect(result.onboardingProfile).toMatchObject({
      displayName: 'Aayush',
      dateOfBirth: '2000-01-01',
      cityId: 'pune',
      vibeTags: ['clubs', 'live_music', 'lounges'],
      intents: ['discover'],
    });
    expect(result.routeAccess.canAccessSignedInExplore).toBe(true);
    expect(result.routeAccess.canCheckout).toBe(true);
  });

  it('keeps profileVersion stable for identical city and preference retries', async () => {
    const { db, read } = makeDb({
      uid: 'user_1',
      city: 'Pune',
      discoveryProfile: {
        cityId: 'pune',
        cityName: 'Pune',
        citySource: 'manual',
        vibeTags: ['clubs', 'live_music', 'lounges'],
        intents: ['discover'],
        profileVersion: 4,
      },
    });

    await updateOnboardingCity(db, 'user_1', {
      cityId: 'pune',
      cityName: 'Pune',
      source: 'manual',
    });
    await updateOnboardingPreferences(db, 'user_1', {
      vibeTags: ['clubs', 'live_music', 'lounges'],
      intents: ['discover'],
    });

    expect(read().discoveryProfile.profileVersion).toBe(4);
  });

  it('honors only the server migration marker for nonblocking legacy preferences', () => {
    const result = buildOnboardingBootstrap(
      'user_1',
      {
        uid: 'user_1',
        onboardingComplete: true,
        identity: { displayName: 'Legacy Member', dateOfBirth: '1995-01-01' },
        discoveryProfile: { cityId: 'pune', cityName: 'Pune', vibeTags: [], intents: [] },
        consumerOnboarding: {
          emailPromptStatus: 'skipped',
          migration: { version: 2, nonblockingPreferences: true },
        },
      },
      phoneUser,
    );

    expect(result.onboarding.currentStage).toBe('complete');
  });

  it('sync clears forged legacy contact aliases when Firebase has no phone', async () => {
    const { db, read } = makeDb({
      uid: 'user_1',
      phone: '+918888888888',
      phoneNumber: '+918888888888',
    });

    const result = await syncOnboardingAuthState(db, 'user_1', googleUser);

    expect(read().phone).toBeNull();
    expect(read().phoneNumber).toBeNull();
    expect(result.onboarding.currentStage).toBe('phone_required');
  });

  it('completes only consumerOnboarding and does not repurpose legacy guest flags', async () => {
    const { db, read } = makeDb({
      uid: 'user_1',
      onboardingComplete: false,
      identity: { displayName: 'Aayush', dateOfBirth: '2000-01-01' },
      discoveryProfile: {
        cityId: 'pune',
        cityName: 'Pune',
        vibeTags: ['clubs', 'live_music', 'lounges'],
        intents: ['discover'],
      },
    });

    await completeOnboarding(db, 'user_1', { ...googleUser, phoneNumber: '+919999999999' });

    expect(read().consumerOnboarding.currentStage).toBe('complete');
    expect(read().discoveryProfile.profileVersion).toBe(2);
    expect(read().onboardingComplete).toBe(false);
  });
});
