import { ONBOARDING_V2_VERSION } from '@c1rcle/types';
import { buildOnboardingBootstrap, normalizeAuthIdentity } from './onboarding-service.js';

export const ONBOARDING_MIGRATION_VERSION = ONBOARDING_V2_VERSION;

const LEGACY_COMPLETION_FIELDS = [
  'onboardingComplete',
  'basicSetupComplete',
  'profileSetupComplete',
  'profileComplete',
];

function hasLegacyCompletion(data = {}) {
  return LEGACY_COMPLETION_FIELDS.some((field) => data[field] === true);
}

function providerIds(authRecord = {}) {
  return [
    ...new Set((authRecord.providerData || []).map((entry) => entry?.providerId).filter(Boolean)),
  ];
}

function cityIdFromName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-');
}

function canonicalizeLegacyProfile(data = {}) {
  const cityName = data.discoveryProfile?.cityName || data.city || null;
  return {
    ...data,
    identity: {
      ...(data.identity || {}),
      displayName: data.identity?.displayName || data.displayName || data.name || '',
      dateOfBirth: data.identity?.dateOfBirth || data.dateOfBirth || null,
    },
    discoveryProfile: {
      ...(data.discoveryProfile || {}),
      cityId: data.discoveryProfile?.cityId || data.cityId || cityIdFromName(cityName) || null,
      cityName,
      vibeTags: data.discoveryProfile?.vibeTags || data.vibeTags || [],
      intents: data.discoveryProfile?.intents || data.intents || [],
      profileVersion: Number(data.discoveryProfile?.profileVersion || 1),
    },
  };
}

export function classifyOnboardingMigration(userId, data = {}, authRecord = null) {
  const providers = providerIds(authRecord || {});
  const firebasePhone = authRecord?.phoneNumber || null;
  const firestorePhone = data.phone || data.phoneNumber || data.auth?.phoneNumberE164 || null;
  const canonicalData = canonicalizeLegacyProfile(data);
  const legacyComplete = hasLegacyCompletion(data);
  const phoneFirst =
    providers.includes('phone') &&
    !providers.includes('google.com') &&
    !providers.includes('apple.com');
  const skipLegacyEmailPrompt = legacyComplete && phoneFirst && !authRecord?.email;
  const bootstrap = buildOnboardingBootstrap(
    userId,
    skipLegacyEmailPrompt
      ? {
          ...canonicalData,
          consumerOnboarding: {
            ...(canonicalData.consumerOnboarding || {}),
            emailPromptStatus: 'skipped',
          },
        }
      : canonicalData,
    authRecord || {},
  );
  const missingPreferences = ['tastes', 'intent'].includes(bootstrap.onboarding.currentStage);
  const allowNonblockingPreferences = legacyComplete && missingPreferences;

  return {
    providers,
    firebasePhone,
    firestorePhone,
    firestoreOnlyPhone: Boolean(firestorePhone && !firebasePhone),
    missingEmail: !authRecord?.email,
    missingDob: !bootstrap.onboardingProfile.dateOfBirth,
    missingCity: !bootstrap.onboardingProfile.cityId && !bootstrap.onboardingProfile.cityName,
    missingTastes: !bootstrap.onboardingProfile.vibeTags?.length,
    v1Complete: legacyComplete,
    v2Complete: bootstrap.onboarding.currentStage === 'complete' || allowNonblockingPreferences,
    allowNonblockingPreferences,
    skipLegacyEmailPrompt,
    canonicalStage: allowNonblockingPreferences ? 'complete' : bootstrap.onboarding.currentStage,
  };
}

export function planOnboardingV2Migration(
  userId,
  data = {},
  authRecord = null,
  migratedAt = new Date().toISOString(),
) {
  const currentMigration = Number(data.consumerOnboarding?.migration?.version || 0);
  const classification = classifyOnboardingMigration(userId, data, authRecord);
  if (currentMigration >= ONBOARDING_MIGRATION_VERSION) {
    return { changed: false, classification, patch: null };
  }

  const identity = normalizeAuthIdentity(userId, authRecord || {}, data);
  const canonicalData = canonicalizeLegacyProfile(data);
  const completedAt =
    classification.canonicalStage === 'complete'
      ? data.consumerOnboarding?.completedAt || data.onboardingCompletedAt || migratedAt
      : null;
  const patch = {
    email: identity.email,
    emailVerified: identity.emailVerified,
    phone: identity.phoneNumberE164,
    phoneNumber: identity.phoneNumberE164,
    phoneVerifiedAt: identity.phoneVerifiedAt,
    auth: {
      ...(data.auth || {}),
      providers: identity.providers,
      primaryProvider: identity.primaryProvider,
      email: identity.email,
      emailVerified: identity.emailVerified,
      emailSource: identity.emailSource,
      phoneNumberE164: identity.phoneNumberE164,
      phoneVerifiedAt: identity.phoneVerifiedAt,
    },
    identity: canonicalData.identity,
    discoveryProfile: canonicalData.discoveryProfile,
    consumerOnboarding: {
      ...(data.consumerOnboarding || {}),
      version: ONBOARDING_V2_VERSION,
      currentStage: classification.canonicalStage,
      ...(classification.skipLegacyEmailPrompt ? { emailPromptStatus: 'skipped' } : {}),
      completedAt,
      updatedAt: migratedAt,
      migration: {
        version: ONBOARDING_MIGRATION_VERSION,
        migratedAt,
        source: 'legacy_backfill',
        nonblockingPreferences: classification.allowNonblockingPreferences,
      },
    },
    updatedAt: migratedAt,
  };

  return { changed: true, classification, patch };
}

export function createOnboardingMigrationReport() {
  return {
    totalUsers: 0,
    providerDistribution: {},
    missingFirebaseUser: 0,
    missingFirestoreDocument: 0,
    missingPhone: 0,
    firestoreOnlyPhone: 0,
    missingEmail: 0,
    missingDob: 0,
    missingCity: 0,
    missingTastes: 0,
    v1Complete: 0,
    v2Complete: 0,
    documentsThatWouldChange: 0,
  };
}

export function addToOnboardingMigrationReport(
  report,
  plan,
  hasFirebaseUser = true,
  hasFirestoreDocument = true,
) {
  const next = report;
  const item = plan.classification;
  next.totalUsers += 1;
  if (!hasFirebaseUser) next.missingFirebaseUser += 1;
  if (!hasFirestoreDocument) next.missingFirestoreDocument += 1;
  if (!item.firebasePhone) next.missingPhone += 1;
  if (item.firestoreOnlyPhone) next.firestoreOnlyPhone += 1;
  if (item.missingEmail) next.missingEmail += 1;
  if (item.missingDob) next.missingDob += 1;
  if (item.missingCity) next.missingCity += 1;
  if (item.missingTastes) next.missingTastes += 1;
  if (item.v1Complete) next.v1Complete += 1;
  if (item.v2Complete) next.v2Complete += 1;
  if (plan.changed) next.documentsThatWouldChange += 1;
  const providers = item.providers.length ? item.providers : ['none'];
  for (const provider of providers) {
    next.providerDistribution[provider] = (next.providerDistribution[provider] || 0) + 1;
  }
  return next;
}
