export const GUEST_ONBOARDING_VERSION = 2;
export const MINIMUM_ACCOUNT_AGE = 18;
export const MINIMUM_NIGHTLIFE_TASTES = 3;

export const NIGHTLIFE_TASTE_IDS = Object.freeze([
  'clubs',
  'live_music',
  'lounges',
  'festivals',
  'college_nights',
  'underground',
  'food_culture',
  'premium',
]);

export const USER_INTENT_IDS = Object.freeze([
  'discover',
  'friends',
  'meet_people',
  'host_promote',
]);

const EMAIL_PROMPT_STATUSES = new Set([
  'not_shown',
  'shown',
  'skipped',
  'pending_verification',
  'verified',
]);

function onboardingError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function nowIso(now = new Date()) {
  return now.toISOString();
}

function normalizeString(value) {
  const normalized = String(value || '').trim();
  return normalized || null;
}

function normalizeStringArray(value, allowedValues) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(normalizeString).filter((item) => item && allowedValues.has(item)))];
}

function normalizeAuthIdentity(authIdentity = {}) {
  return {
    phoneNumber:
      normalizeString(authIdentity.phoneNumber) ||
      normalizeString(authIdentity.phone_number) ||
      normalizeString(authIdentity.phone),
    email: normalizeString(authIdentity.email),
  };
}

function parseDateOfBirth(value) {
  const normalized = normalizeString(value);
  const match = normalized?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;

  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (
    date.getUTCFullYear() !== Number(match[1]) ||
    date.getUTCMonth() !== Number(match[2]) - 1 ||
    date.getUTCDate() !== Number(match[3])
  ) {
    return null;
  }
  return date;
}

export function calculateAccountAge(dateOfBirth, now = new Date()) {
  const date = parseDateOfBirth(dateOfBirth);
  if (!date) return null;

  let age = now.getUTCFullYear() - date.getUTCFullYear();
  const beforeBirthday =
    now.getUTCMonth() < date.getUTCMonth() ||
    (now.getUTCMonth() === date.getUTCMonth() && now.getUTCDate() < date.getUTCDate());
  if (beforeBirthday) age -= 1;
  return age;
}

function readProfileState(profile = {}) {
  const onboarding = profile.onboarding || {};
  const identity = profile.identity || {};
  const discovery = profile.discoveryProfile || {};
  return {
    onboarding,
    displayName:
      normalizeString(identity.displayName) ||
      normalizeString(profile.displayName) ||
      normalizeString(profile.name),
    dateOfBirth: normalizeString(identity.dateOfBirth) || normalizeString(profile.dateOfBirth),
    cityId: normalizeString(discovery.cityId) || normalizeString(profile.cityId),
    cityName:
      normalizeString(discovery.cityName) ||
      normalizeString(profile.cityName) ||
      normalizeString(profile.city),
    vibeTags: normalizeStringArray(
      discovery.vibeTags || profile.vibeTags,
      new Set(NIGHTLIFE_TASTE_IDS),
    ),
    intents: normalizeStringArray(discovery.intents || profile.intents, new Set(USER_INTENT_IDS)),
  };
}

function resolveStage(profile, authIdentity) {
  const state = readProfileState(profile);
  const auth = normalizeAuthIdentity(authIdentity);
  const emailPromptStatus = EMAIL_PROMPT_STATUSES.has(state.onboarding.emailPromptStatus)
    ? state.onboarding.emailPromptStatus
    : 'not_shown';

  if (!auth.phoneNumber) return 'phone_required';

  const legacyComplete =
    profile.onboardingComplete === true &&
    (profile.basicSetupComplete === true || profile.profileSetupComplete === true);
  if (legacyComplete || state.onboarding.completed === true) return 'complete';

  if (!auth.email && !['skipped', 'pending_verification', 'verified'].includes(emailPromptStatus)) {
    return 'email_optional';
  }
  if (!state.displayName || !state.dateOfBirth) return 'identity';
  if (!state.cityId && !state.cityName) return 'city';
  if (state.vibeTags.length < MINIMUM_NIGHTLIFE_TASTES) return 'tastes';
  if (state.intents.length === 0) return 'intent';
  return 'complete';
}

export function buildGuestOnboardingSnapshot(profile = {}, authIdentity = {}) {
  const state = readProfileState(profile);
  const currentStage = resolveStage(profile, authIdentity);
  const emailPromptStatus = EMAIL_PROMPT_STATUSES.has(state.onboarding.emailPromptStatus)
    ? state.onboarding.emailPromptStatus
    : 'not_shown';

  return {
    version: GUEST_ONBOARDING_VERSION,
    currentStage,
    completed: currentStage === 'complete',
    emailPromptStatus,
    startedAt: state.onboarding.startedAt || profile.createdAt || null,
    completedAt:
      currentStage === 'complete'
        ? state.onboarding.completedAt || profile.onboardingCompletedAt || null
        : null,
    updatedAt: state.onboarding.updatedAt || profile.updatedAt || null,
    displayName: state.displayName,
    dateOfBirth: state.dateOfBirth,
    cityId: state.cityId,
    cityName: state.cityName,
    vibeTags: state.vibeTags,
    intents: state.intents,
  };
}

async function readUserOrThrow(reader, userRef) {
  const snapshot = await reader.get(userRef);
  if (!snapshot.exists) {
    throw onboardingError('USER_NOT_FOUND', 'User profile not found');
  }
  return snapshot.data() || {};
}

async function mutateGuestOnboarding(db, userId, authIdentity, buildUpdate, now = new Date()) {
  if (!userId) throw onboardingError('UNAUTHORIZED', 'Authentication required');
  const userRef = db.collection('users').doc(userId);

  return db.runTransaction(async (transaction) => {
    const profile = await readUserOrThrow(transaction, userRef);
    const auth = normalizeAuthIdentity(authIdentity);
    if (!auth.phoneNumber) {
      throw onboardingError('PHONE_VERIFICATION_REQUIRED', 'Verified phone number is required');
    }

    const timestamp = nowIso(now);
    const update = buildUpdate(profile, timestamp);
    transaction.set(userRef, update, { merge: true });
    const mergedProfile = {
      ...profile,
      ...update,
      onboarding: { ...(profile.onboarding || {}), ...(update.onboarding || {}) },
      identity: { ...(profile.identity || {}), ...(update.identity || {}) },
      discoveryProfile: {
        ...(profile.discoveryProfile || {}),
        ...(update.discoveryProfile || {}),
      },
    };
    return buildGuestOnboardingSnapshot(mergedProfile, auth);
  });
}

export async function getGuestOnboardingSnapshot(db, userId, authIdentity = {}) {
  if (!userId) throw onboardingError('UNAUTHORIZED', 'Authentication required');
  const snapshot = await db.collection('users').doc(userId).get();
  if (!snapshot.exists) throw onboardingError('USER_NOT_FOUND', 'User profile not found');
  return buildGuestOnboardingSnapshot(snapshot.data() || {}, authIdentity);
}

export async function saveGuestOnboardingIdentity(
  db,
  userId,
  authIdentity,
  { displayName, dateOfBirth },
  now = new Date(),
) {
  const normalizedName = normalizeString(displayName);
  const normalizedDateOfBirth = normalizeString(dateOfBirth);
  const age = calculateAccountAge(normalizedDateOfBirth, now);
  if (!normalizedName || normalizedName.length < 2 || normalizedName.length > 100) {
    throw onboardingError('ONBOARDING_IDENTITY_INVALID', 'Display name is invalid');
  }
  if (age === null || age < MINIMUM_ACCOUNT_AGE) {
    throw onboardingError(
      'ONBOARDING_AGE_RESTRICTED',
      `Account holder must be at least ${MINIMUM_ACCOUNT_AGE}`,
    );
  }

  return mutateGuestOnboarding(
    db,
    userId,
    authIdentity,
    (profile, timestamp) => ({
      displayName: normalizedName,
      name: normalizedName,
      dateOfBirth: normalizedDateOfBirth,
      identity: {
        ...(profile.identity || {}),
        displayName: normalizedName,
        dateOfBirth: normalizedDateOfBirth,
      },
      onboarding: {
        ...(profile.onboarding || {}),
        version: GUEST_ONBOARDING_VERSION,
        startedAt: profile.onboarding?.startedAt || timestamp,
        updatedAt: timestamp,
      },
      updatedAt: timestamp,
    }),
    now,
  );
}

export async function saveGuestOnboardingCity(
  db,
  userId,
  authIdentity,
  { cityId, cityName, source },
  now = new Date(),
) {
  const normalizedCityId = normalizeString(cityId);
  const normalizedCityName = normalizeString(cityName);
  if (!normalizedCityId || !normalizedCityName || !['manual', 'location'].includes(source)) {
    throw onboardingError('ONBOARDING_CITY_INVALID', 'City selection is invalid');
  }

  return mutateGuestOnboarding(
    db,
    userId,
    authIdentity,
    (profile, timestamp) => ({
      city: normalizedCityName,
      cityId: normalizedCityId,
      cityName: normalizedCityName,
      discoveryProfile: {
        ...(profile.discoveryProfile || {}),
        cityId: normalizedCityId,
        cityName: normalizedCityName,
        citySource: source,
      },
      onboarding: {
        ...(profile.onboarding || {}),
        version: GUEST_ONBOARDING_VERSION,
        startedAt: profile.onboarding?.startedAt || timestamp,
        updatedAt: timestamp,
      },
      updatedAt: timestamp,
    }),
    now,
  );
}

export async function saveGuestOnboardingPreferences(
  db,
  userId,
  authIdentity,
  updates,
  now = new Date(),
) {
  const hasVibeTags = Object.prototype.hasOwnProperty.call(updates, 'vibeTags');
  const hasIntents = Object.prototype.hasOwnProperty.call(updates, 'intents');
  if (!hasVibeTags && !hasIntents) {
    throw onboardingError('ONBOARDING_PREFERENCES_INVALID', 'Preferences are required');
  }

  const vibeTags = hasVibeTags
    ? normalizeStringArray(updates.vibeTags, new Set(NIGHTLIFE_TASTE_IDS))
    : null;
  const intents = hasIntents
    ? normalizeStringArray(updates.intents, new Set(USER_INTENT_IDS))
    : null;
  if (hasVibeTags && vibeTags.length < MINIMUM_NIGHTLIFE_TASTES) {
    throw onboardingError(
      'ONBOARDING_PREFERENCES_INVALID',
      `Select at least ${MINIMUM_NIGHTLIFE_TASTES} nightlife tastes`,
    );
  }
  if (hasIntents && intents.length === 0) {
    throw onboardingError('ONBOARDING_PREFERENCES_INVALID', 'Select at least one intent');
  }

  return mutateGuestOnboarding(
    db,
    userId,
    authIdentity,
    (profile, timestamp) => {
      const discoveryProfile = { ...(profile.discoveryProfile || {}) };
      const update = {
        onboarding: {
          ...(profile.onboarding || {}),
          version: GUEST_ONBOARDING_VERSION,
          startedAt: profile.onboarding?.startedAt || timestamp,
          updatedAt: timestamp,
        },
        discoveryProfile,
        updatedAt: timestamp,
      };
      if (hasVibeTags) {
        update.vibeTags = vibeTags;
        discoveryProfile.vibeTags = vibeTags;
      }
      if (hasIntents) {
        update.intents = intents;
        discoveryProfile.intents = intents;
      }
      return update;
    },
    now,
  );
}

export async function saveGuestEmailPromptStatus(
  db,
  userId,
  authIdentity,
  status,
  now = new Date(),
) {
  if (!EMAIL_PROMPT_STATUSES.has(status) || status === 'not_shown') {
    throw onboardingError('ONBOARDING_EMAIL_STATUS_INVALID', 'Email prompt status is invalid');
  }
  return mutateGuestOnboarding(
    db,
    userId,
    authIdentity,
    (profile, timestamp) => ({
      onboarding: {
        ...(profile.onboarding || {}),
        version: GUEST_ONBOARDING_VERSION,
        emailPromptStatus: status,
        startedAt: profile.onboarding?.startedAt || timestamp,
        updatedAt: timestamp,
      },
      updatedAt: timestamp,
    }),
    now,
  );
}

export async function completeGuestOnboarding(db, userId, authIdentity, now = new Date()) {
  return mutateGuestOnboarding(
    db,
    userId,
    authIdentity,
    (profile, timestamp) => {
      const snapshot = buildGuestOnboardingSnapshot(profile, authIdentity);
      if (snapshot.currentStage !== 'complete') {
        throw onboardingError(
          'ONBOARDING_INCOMPLETE',
          `Onboarding cannot complete from stage ${snapshot.currentStage}`,
        );
      }
      return {
        onboardingComplete: true,
        basicSetupComplete: true,
        profileSetupComplete: true,
        onboardingCompletedAt: profile.onboardingCompletedAt || timestamp,
        onboarding: {
          ...(profile.onboarding || {}),
          version: GUEST_ONBOARDING_VERSION,
          completed: true,
          currentStage: 'complete',
          completedAt: profile.onboarding?.completedAt || timestamp,
          startedAt: profile.onboarding?.startedAt || profile.createdAt || timestamp,
          updatedAt: timestamp,
        },
        updatedAt: timestamp,
      };
    },
    now,
  );
}
