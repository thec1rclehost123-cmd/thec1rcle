import { describe, expect, it } from 'vitest';
import {
  addToOnboardingMigrationReport,
  createOnboardingMigrationReport,
  planOnboardingV2Migration,
} from './onboarding-migration.js';

const migratedAt = '2026-07-13T00:00:00.000Z';
const completeLegacyProfile = {
  uid: 'legacy_1',
  onboardingComplete: true,
  basicSetupComplete: true,
  displayName: 'Legacy Member',
  dateOfBirth: '1995-01-01',
  city: 'Pune',
};

describe('onboarding v2 migration', () => {
  it('never upgrades a Firestore-only phone to verified identity', () => {
    const plan = planOnboardingV2Migration(
      'legacy_1',
      { ...completeLegacyProfile, phone: '+919999999999' },
      { uid: 'legacy_1', providerData: [{ providerId: 'google.com' }] },
      migratedAt,
    );

    expect(plan.classification.firestoreOnlyPhone).toBe(true);
    expect(plan.classification.canonicalStage).toBe('phone_required');
    expect(plan.patch.phone).toBeNull();
    expect(plan.patch.auth.phoneNumberE164).toBeNull();
  });

  it('keeps verified legacy users out of forced preference onboarding', () => {
    const plan = planOnboardingV2Migration(
      'legacy_1',
      completeLegacyProfile,
      {
        uid: 'legacy_1',
        phoneNumber: '+919999999999',
        providerData: [{ providerId: 'phone' }],
      },
      migratedAt,
    );

    expect(plan.classification.allowNonblockingPreferences).toBe(true);
    expect(plan.patch.consumerOnboarding).toMatchObject({
      version: 2,
      currentStage: 'complete',
      migration: { version: 2, nonblockingPreferences: true },
    });
  });

  it('is idempotent after the migration marker is present', () => {
    const first = planOnboardingV2Migration(
      'legacy_1',
      completeLegacyProfile,
      { uid: 'legacy_1', phoneNumber: '+919999999999', providerData: [] },
      migratedAt,
    );
    const second = planOnboardingV2Migration(
      'legacy_1',
      { ...completeLegacyProfile, ...first.patch },
      { uid: 'legacy_1', phoneNumber: '+919999999999', providerData: [] },
      '2026-07-14T00:00:00.000Z',
    );

    expect(first.changed).toBe(true);
    expect(second).toMatchObject({ changed: false, patch: null });
  });

  it('produces an auditable dry-run report', () => {
    const plan = planOnboardingV2Migration(
      'legacy_1',
      { ...completeLegacyProfile, phone: '+918888888888' },
      { uid: 'legacy_1', providerData: [{ providerId: 'google.com' }] },
      migratedAt,
    );
    const report = addToOnboardingMigrationReport(createOnboardingMigrationReport(), plan);

    expect(report).toMatchObject({
      totalUsers: 1,
      firestoreOnlyPhone: 1,
      missingPhone: 1,
      missingEmail: 1,
      v1Complete: 1,
      documentsThatWouldChange: 1,
      providerDistribution: { 'google.com': 1 },
    });
  });
});
