export type OnboardingMigrationCohort =
  | 'already_migrated_v2'
  | 'orphaned_firestore_user'
  | 'legacy_complete_grandfathered'
  | 'legacy_complete_phone_required'
  | 'canonical_complete'
  | 'incomplete_phone_required'
  | 'incomplete_email_optional'
  | 'incomplete_identity'
  | 'incomplete_city'
  | 'incomplete_tastes'
  | 'incomplete_intent';

export interface OnboardingMigrationClassification {
  userId: string;
  cohort: OnboardingMigrationCohort;
  currentStage: string;
  firebasePhoneVerified: boolean;
  legacyComplete: boolean;
  proposedChanges: Record<string, unknown>;
  shouldApply: boolean;
}

export const ONBOARDING_V2_MIGRATION_VERSION: 2;
export const ONBOARDING_V2_MIGRATION_KEY: 'consumerOnboardingV2';
export const onboardingMigrationCohorts: OnboardingMigrationCohort[];
export function classifyOnboardingV2Migration(input: {
  userId: string;
  data?: Record<string, any>;
  authRecord?: Record<string, any> | null;
}): OnboardingMigrationClassification;
export function buildOnboardingV2ApplyPatch(
  classification: OnboardingMigrationClassification,
  existingData: Record<string, any>,
  migratedAt: string,
): Record<string, any>;
