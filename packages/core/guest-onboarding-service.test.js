import { describe, expect, it } from 'vitest';
import {
  buildGuestOnboardingSnapshot,
  completeGuestOnboarding,
  getGuestOnboardingSnapshot,
  saveGuestOnboardingCity,
  saveGuestOnboardingIdentity,
  saveGuestOnboardingPreferences,
} from './guest-onboarding-service.js';

function deepMerge(target, source) {
  const output = { ...target };
  for (const [key, value] of Object.entries(source || {})) {
    output[key] =
      value && typeof value === 'object' && !Array.isArray(value)
        ? deepMerge(target?.[key] || {}, value)
        : value;
  }
  return output;
}

function createDb(seed = {}) {
  const records = new Map(Object.entries(seed));
  const reference = (collectionName, id) => ({
    path: `${collectionName}/${id}`,
    id,
    async get() {
      const value = records.get(this.path);
      return {
        exists: value !== undefined,
        id,
        data: () => value,
      };
    },
  });

  return {
    records,
    collection(name) {
      return {
        doc(id) {
          return reference(name, id);
        },
      };
    },
    async runTransaction(handler) {
      const writes = [];
      const transaction = {
        get: (ref) => ref.get(),
        set: (ref, value, options) => writes.push({ ref, value, options }),
      };
      const result = await handler(transaction);
      for (const write of writes) {
        const previous = records.get(write.ref.path) || {};
        records.set(
          write.ref.path,
          write.options?.merge ? deepMerge(previous, write.value) : write.value,
        );
      }
      return result;
    },
  };
}

const phoneIdentity = { phoneNumber: '+919999999999', email: 'guest@example.com' };

describe('guest onboarding service', () => {
  it('preserves completed legacy accounts during the version-2 migration window', () => {
    const snapshot = buildGuestOnboardingSnapshot(
      {
        onboardingComplete: true,
        basicSetupComplete: true,
        displayName: 'Guest',
      },
      phoneIdentity,
    );

    expect(snapshot.currentStage).toBe('complete');
    expect(snapshot.completed).toBe(true);
    expect(snapshot.version).toBe(2);
  });

  it('persists identity, city, tastes, intents, and completion transactionally', async () => {
    const db = createDb({
      'users/user_1': { createdAt: '2026-01-01T00:00:00.000Z' },
    });
    const now = new Date('2026-07-27T12:00:00.000Z');

    let snapshot = await saveGuestOnboardingIdentity(
      db,
      'user_1',
      phoneIdentity,
      { displayName: 'QA Guest', dateOfBirth: '2000-01-01' },
      now,
    );
    expect(snapshot.currentStage).toBe('city');

    snapshot = await saveGuestOnboardingCity(
      db,
      'user_1',
      phoneIdentity,
      { cityId: 'pune', cityName: 'Pune', source: 'manual' },
      now,
    );
    expect(snapshot.currentStage).toBe('tastes');

    snapshot = await saveGuestOnboardingPreferences(
      db,
      'user_1',
      phoneIdentity,
      { vibeTags: ['clubs', 'live_music', 'lounges'] },
      now,
    );
    expect(snapshot.currentStage).toBe('intent');

    snapshot = await saveGuestOnboardingPreferences(
      db,
      'user_1',
      phoneIdentity,
      { intents: ['discover'] },
      now,
    );
    expect(snapshot.currentStage).toBe('complete');

    snapshot = await completeGuestOnboarding(db, 'user_1', phoneIdentity, now);
    expect(snapshot.completed).toBe(true);
    expect(db.records.get('users/user_1')).toMatchObject({
      displayName: 'QA Guest',
      city: 'Pune',
      vibeTags: ['clubs', 'live_music', 'lounges'],
      intents: ['discover'],
      onboardingComplete: true,
      onboarding: { version: 2, completed: true, currentStage: 'complete' },
    });
  });

  it('fails closed for an unverified phone or an underage identity without writing', async () => {
    const db = createDb({ 'users/user_1': { displayName: 'Before' } });

    await expect(
      saveGuestOnboardingIdentity(
        db,
        'user_1',
        { email: 'guest@example.com' },
        { displayName: 'QA Guest', dateOfBirth: '2000-01-01' },
      ),
    ).rejects.toMatchObject({ code: 'PHONE_VERIFICATION_REQUIRED' });
    await expect(
      saveGuestOnboardingIdentity(
        db,
        'user_1',
        phoneIdentity,
        { displayName: 'QA Guest', dateOfBirth: '2012-01-01' },
        new Date('2026-07-27T12:00:00.000Z'),
      ),
    ).rejects.toMatchObject({ code: 'ONBOARDING_AGE_RESTRICTED' });
    expect(db.records.get('users/user_1')).toEqual({ displayName: 'Before' });
  });

  it('returns the canonical persisted snapshot', async () => {
    const db = createDb({
      'users/user_1': {
        identity: { displayName: 'Guest', dateOfBirth: '2000-01-01' },
        discoveryProfile: {
          cityId: 'pune',
          cityName: 'Pune',
          vibeTags: ['clubs', 'live_music', 'lounges'],
          intents: ['discover'],
        },
      },
    });

    await expect(getGuestOnboardingSnapshot(db, 'user_1', phoneIdentity)).resolves.toMatchObject({
      currentStage: 'complete',
      cityId: 'pune',
      vibeTags: ['clubs', 'live_music', 'lounges'],
    });
  });
});
