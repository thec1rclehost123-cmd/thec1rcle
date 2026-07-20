export type OnboardingMigrationClassification = {
  providers: string[];
  firebasePhone: string | null;
  firestorePhone: string | null;
  firestoreOnlyPhone: boolean;
  missingEmail: boolean;
  missingDob: boolean;
  missingCity: boolean;
  missingTastes: boolean;
  v1Complete: boolean;
  v2Complete: boolean;
  allowNonblockingPreferences: boolean;
  skipLegacyEmailPrompt: boolean;
  canonicalStage: string;
};

export type OnboardingMigrationPlan = {
  changed: boolean;
  classification: OnboardingMigrationClassification;
  patch: Record<string, unknown> | null;
};

export type OnboardingMigrationReport = {
  totalUsers: number;
  providerDistribution: Record<string, number>;
  missingFirebaseUser: number;
  missingFirestoreDocument: number;
  missingPhone: number;
  firestoreOnlyPhone: number;
  missingEmail: number;
  missingDob: number;
  missingCity: number;
  missingTastes: number;
  v1Complete: number;
  v2Complete: number;
  documentsThatWouldChange: number;
};

export const ONBOARDING_MIGRATION_VERSION: number;
export function classifyOnboardingMigration(
  userId: string,
  data?: Record<string, any>,
  authRecord?: Record<string, any> | null,
): OnboardingMigrationClassification;
export function planOnboardingV2Migration(
  userId: string,
  data?: Record<string, any>,
  authRecord?: Record<string, any> | null,
  migratedAt?: string,
): OnboardingMigrationPlan;
export function createOnboardingMigrationReport(): OnboardingMigrationReport;
export function addToOnboardingMigrationReport(
  report: OnboardingMigrationReport,
  plan: OnboardingMigrationPlan,
  hasFirebaseUser?: boolean,
  hasFirestoreDocument?: boolean,
): OnboardingMigrationReport;
