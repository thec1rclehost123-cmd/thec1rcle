const ONBOARDING_VERSION = 2;
const MIN_TASTES = 3;
const VALID_TASTES = new Set([
  'clubs',
  'live_music',
  'lounges',
  'festivals',
  'college_nights',
  'underground',
  'food_culture',
  'premium',
]);
const VALID_INTENTS = new Set(['discover', 'friends', 'meet_people', 'host_promote']);
const EMAIL_PROMPT_STATUSES = new Set([
  'not_shown',
  'shown',
  'skipped',
  'pending_verification',
  'verified',
]);

function nowIso() {
  return new Date().toISOString();
}

function arraysEqual(left = [], right = []) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function onboardingError(code, message, statusCode = 400, details = undefined) {
  const error = new Error(message);
  error.code = code;
  error.statusCode = statusCode;
  error.details = details;
  return error;
}

function normalizeProvider(providerId) {
  if (providerId === 'apple.com' || providerId === 'apple') return 'apple';
  if (providerId === 'google.com' || providerId === 'google') return 'google';
  if (providerId === 'phone') return 'phone';
  return null;
}

export function normalizeAuthIdentity(userId, authRecord = {}, existingData = {}) {
  const providers = [];
  for (const entry of authRecord.providerData || []) {
    const provider = normalizeProvider(entry?.providerId);
    if (provider && !providers.includes(provider)) providers.push(provider);
  }

  const signInProvider = normalizeProvider(
    authRecord?.firebase?.sign_in_provider || authRecord?.sign_in_provider,
  );
  if (signInProvider && !providers.includes(signInProvider)) providers.push(signInProvider);
  if (authRecord.phoneNumber && !providers.includes('phone')) providers.push('phone');

  const primaryProvider =
    signInProvider || providers.find((provider) => provider !== 'phone') || providers[0] || null;
  const emailSource = providers.includes('apple')
    ? 'apple'
    : providers.includes('google')
      ? 'google'
      : authRecord.email
        ? 'manual'
        : null;
  const previousPhone = existingData?.auth?.phoneNumberE164 || null;
  const phoneNumberE164 = authRecord.phoneNumber || authRecord.phone_number || null;
  const phoneVerifiedAt = phoneNumberE164
    ? previousPhone === phoneNumberE164
      ? existingData?.auth?.phoneVerifiedAt || existingData.phoneVerifiedAt || nowIso()
      : nowIso()
    : null;

  return {
    uid: userId,
    providers,
    primaryProvider,
    email: authRecord.email || null,
    emailVerified: authRecord.emailVerified === true || authRecord.email_verified === true,
    emailSource,
    phoneNumberE164,
    phoneVerified: Boolean(phoneNumberE164),
    phoneVerifiedAt,
  };
}

function readIdentity(data = {}) {
  return {
    displayName: data.identity?.displayName || data.displayName || data.name || '',
    dateOfBirth: data.identity?.dateOfBirth || data.dateOfBirth || null,
  };
}

function readDiscoveryProfile(data = {}) {
  const discoveryProfile = data.discoveryProfile || {};
  return {
    cityId: discoveryProfile.cityId || data.cityId || null,
    cityName: discoveryProfile.cityName || data.city || null,
    citySource: discoveryProfile.citySource || null,
    vibeTags: Array.isArray(discoveryProfile.vibeTags)
      ? discoveryProfile.vibeTags
      : Array.isArray(data.vibeTags)
        ? data.vibeTags
        : [],
    intents: Array.isArray(discoveryProfile.intents)
      ? discoveryProfile.intents
      : Array.isArray(data.intents)
        ? data.intents
        : [],
    profileVersion: Number(discoveryProfile.profileVersion || 1),
  };
}

function getMinimumAge() {
  const configured = Number(process.env.MIN_ACCOUNT_AGE || 18);
  return Number.isFinite(configured) && configured >= 13 ? configured : 18;
}

function ageOnDate(dateOfBirth, today = new Date()) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateOfBirth || ''));
  if (!match) return null;
  const [, year, month, day] = match;
  const birth = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (Number.isNaN(birth.getTime())) return null;
  if (
    birth.getUTCFullYear() !== Number(year) ||
    birth.getUTCMonth() !== Number(month) - 1 ||
    birth.getUTCDate() !== Number(day)
  ) {
    return null;
  }
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  const monthDelta = today.getUTCMonth() - birth.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age;
}

function hasValidIdentity(data) {
  const identity = readIdentity(data);
  const age = identity.dateOfBirth ? ageOnDate(identity.dateOfBirth) : null;
  return Boolean(identity.displayName.trim()) && age !== null && age >= getMinimumAge();
}

function resolvedEmailPromptStatus(data, authIdentity) {
  if (authIdentity.email && authIdentity.emailVerified) return 'verified';
  if (authIdentity.email) return 'pending_verification';
  const stored = data.consumerOnboarding?.emailPromptStatus;
  return EMAIL_PROMPT_STATUSES.has(stored) ? stored : 'not_shown';
}

export function computeOnboardingStage(
  data = {},
  authIdentity = normalizeAuthIdentity(data.uid || '', {}, data),
) {
  if (!authIdentity.phoneVerified) return 'phone_required';

  const phoneFirst =
    authIdentity.providers.includes('phone') &&
    !authIdentity.providers.includes('apple') &&
    !authIdentity.providers.includes('google');
  const emailPromptStatus = resolvedEmailPromptStatus(data, authIdentity);
  if (phoneFirst && !authIdentity.email && !['skipped', 'verified'].includes(emailPromptStatus)) {
    return 'email_optional';
  }
  if (!hasValidIdentity(data)) return 'identity';

  const discovery = readDiscoveryProfile(data);
  if (!discovery.cityId || !discovery.cityName) return 'city';
  if (discovery.vibeTags.filter((value) => VALID_TASTES.has(value)).length < MIN_TASTES) {
    return 'tastes';
  }
  if (discovery.intents.filter((value) => VALID_INTENTS.has(value)).length < 1) return 'intent';
  return 'complete';
}

export function buildOnboardingBootstrap(userId, data = {}, authRecord = {}) {
  const identity = normalizeAuthIdentity(userId, authRecord, data);
  const currentStage = computeOnboardingStage(data, identity);
  const onboarding = {
    version: ONBOARDING_VERSION,
    currentStage,
    completed: currentStage === 'complete',
    emailPromptStatus: resolvedEmailPromptStatus(data, identity),
    startedAt: data.consumerOnboarding?.startedAt || data.createdAt || null,
    completedAt: currentStage === 'complete' ? data.consumerOnboarding?.completedAt || null : null,
    updatedAt: data.consumerOnboarding?.updatedAt || data.updatedAt || null,
  };
  const verifiedPhone = identity.phoneVerified;
  const complete = currentStage === 'complete';

  return {
    identity,
    onboarding,
    routeAccess: {
      canBrowsePublicExplore: true,
      canAccessSignedInExplore: complete,
      canCheckout: complete && verifiedPhone,
      canUseChat: complete && verifiedPhone,
    },
  };
}

async function getUserDocument(db, userId) {
  const doc = await db.collection('users').doc(userId).get();
  if (!doc.exists) throw onboardingError('USER_NOT_FOUND', 'User not found', 404);
  return { ref: db.collection('users').doc(userId), data: doc.data() || {} };
}

export async function getOnboardingBootstrap(db, userId, authRecord) {
  if (!db) throw onboardingError('MISSING_DATABASE', 'Missing Firestore instance', 500);
  if (!userId) throw onboardingError('MISSING_USER_ID', 'Missing userId', 400);
  const { data } = await getUserDocument(db, userId);
  return buildOnboardingBootstrap(userId, data, authRecord);
}

export async function syncOnboardingAuthState(db, userId, authRecord) {
  const { ref, data } = await getUserDocument(db, userId);
  const now = nowIso();
  const identity = normalizeAuthIdentity(userId, authRecord, data);
  const emailPromptStatus = resolvedEmailPromptStatus(data, identity);
  const nextData = {
    ...data,
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
  };
  const stage = computeOnboardingStage(nextData, identity);
  const onboarding = {
    ...(data.consumerOnboarding || {}),
    version: ONBOARDING_VERSION,
    currentStage: stage,
    emailPromptStatus,
    startedAt: data.consumerOnboarding?.startedAt || data.createdAt || now,
    completedAt: stage === 'complete' ? data.consumerOnboarding?.completedAt || now : null,
    updatedAt: now,
  };

  await ref.set(
    {
      email: identity.email,
      emailVerified: identity.emailVerified,
      phone: identity.phoneNumberE164,
      phoneNumber: identity.phoneNumberE164,
      phoneVerifiedAt: identity.phoneVerifiedAt,
      auth: nextData.auth,
      consumerOnboarding: onboarding,
      updatedAt: now,
    },
    { merge: true },
  );

  return buildOnboardingBootstrap(
    userId,
    { ...nextData, consumerOnboarding: onboarding, updatedAt: now },
    authRecord,
  );
}

async function updateUserSection(db, userId, buildPatch) {
  const userRef = db.collection('users').doc(userId);
  if (typeof db.runTransaction === 'function') {
    return db.runTransaction(async (transaction) => {
      const doc = await transaction.get(userRef);
      if (!doc.exists) throw onboardingError('USER_NOT_FOUND', 'User not found', 404);
      const data = doc.data() || {};
      const patch = buildPatch(data);
      transaction.set(userRef, patch, { merge: true });
      return { ...data, ...patch };
    });
  }

  const { data } = await getUserDocument(db, userId);
  const patch = buildPatch(data);
  await userRef.set(patch, { merge: true });
  return { ...data, ...patch };
}

export async function updateOnboardingIdentity(db, userId, payload) {
  const displayName = String(payload?.displayName || '').trim();
  const dateOfBirth = String(payload?.dateOfBirth || '').trim();
  const age = ageOnDate(dateOfBirth);
  if (!displayName) throw onboardingError('INVALID_DISPLAY_NAME', 'Display name is required', 400);
  if (age === null)
    throw onboardingError('INVALID_DATE_OF_BIRTH', 'Valid date of birth is required', 400);
  if (age < getMinimumAge()) {
    throw onboardingError(
      'AGE_INELIGIBLE',
      `You must be at least ${getMinimumAge()} years old`,
      422,
    );
  }
  const now = nowIso();
  return updateUserSection(db, userId, (data) => ({
    identity: { ...(data.identity || {}), displayName, dateOfBirth },
    displayName,
    name: displayName,
    dateOfBirth,
    consumerOnboarding: {
      ...(data.consumerOnboarding || {}),
      version: ONBOARDING_VERSION,
      updatedAt: now,
    },
    updatedAt: now,
  }));
}

export async function updateOnboardingCity(db, userId, payload) {
  const cityId = String(payload?.cityId || '')
    .trim()
    .toLowerCase();
  const cityName = String(payload?.cityName || '').trim();
  const source = payload?.source;
  if (!cityId || !cityName || !['manual', 'location'].includes(source)) {
    throw onboardingError('INVALID_CITY', 'A valid city and source are required', 400);
  }
  const now = nowIso();
  return updateUserSection(db, userId, (data) => {
    const current = readDiscoveryProfile(data);
    const unchanged =
      current.cityId === cityId && current.cityName === cityName && current.citySource === source;
    return {
      city: cityName,
      cityId,
      discoveryProfile: {
        ...(data.discoveryProfile || {}),
        cityId,
        cityName,
        citySource: source,
        profileVersion: unchanged ? current.profileVersion : current.profileVersion + 1,
        updatedAt: now,
      },
      consumerOnboarding: {
        ...(data.consumerOnboarding || {}),
        version: ONBOARDING_VERSION,
        updatedAt: now,
      },
      updatedAt: now,
    };
  });
}

export async function updateOnboardingPreferences(db, userId, payload) {
  const hasTastes = Array.isArray(payload?.vibeTags);
  const hasIntents = Array.isArray(payload?.intents);
  if (!hasTastes && !hasIntents) {
    throw onboardingError('INVALID_PREFERENCES', 'vibeTags or intents are required', 400);
  }
  const vibeTags = hasTastes ? [...new Set(payload.vibeTags)] : null;
  const intents = hasIntents ? [...new Set(payload.intents)] : null;
  if (
    vibeTags &&
    (vibeTags.length < MIN_TASTES || vibeTags.some((value) => !VALID_TASTES.has(value)))
  ) {
    throw onboardingError(
      'INVALID_TASTES',
      `Choose at least ${MIN_TASTES} valid nightlife tastes`,
      400,
    );
  }
  if (intents && (intents.length < 1 || intents.some((value) => !VALID_INTENTS.has(value)))) {
    throw onboardingError('INVALID_INTENTS', 'Choose at least one valid intent', 400);
  }
  const now = nowIso();
  return updateUserSection(db, userId, (data) => {
    const current = readDiscoveryProfile(data);
    const nextTastes = vibeTags || current.vibeTags;
    const nextIntents = intents || current.intents;
    const unchanged =
      arraysEqual(nextTastes, current.vibeTags) && arraysEqual(nextIntents, current.intents);
    const next = {
      ...(data.discoveryProfile || {}),
      profileVersion: unchanged ? current.profileVersion : current.profileVersion + 1,
      updatedAt: now,
    };
    if (vibeTags) next.vibeTags = vibeTags;
    if (intents) next.intents = intents;
    return {
      ...(vibeTags ? { vibeTags } : {}),
      ...(intents ? { intents } : {}),
      discoveryProfile: next,
      consumerOnboarding: {
        ...(data.consumerOnboarding || {}),
        version: ONBOARDING_VERSION,
        updatedAt: now,
      },
      updatedAt: now,
    };
  });
}

export async function recordEmailPrompt(db, userId, status) {
  if (!['shown', 'skipped'].includes(status)) {
    throw onboardingError(
      'INVALID_EMAIL_PROMPT_STATUS',
      'Email prompt status must be shown or skipped',
      400,
    );
  }
  const now = nowIso();
  return updateUserSection(db, userId, (data) => ({
    consumerOnboarding: {
      ...(data.consumerOnboarding || {}),
      version: ONBOARDING_VERSION,
      emailPromptStatus: status,
      updatedAt: now,
    },
    updatedAt: now,
  }));
}

export async function completeOnboarding(db, userId, authRecord) {
  const { ref, data } = await getUserDocument(db, userId);
  const bootstrap = buildOnboardingBootstrap(userId, data, authRecord);
  if (bootstrap.onboarding.currentStage !== 'complete') {
    throw onboardingError(
      'ONBOARDING_INCOMPLETE',
      `Complete the ${bootstrap.onboarding.currentStage} step first`,
      409,
      { currentStage: bootstrap.onboarding.currentStage },
    );
  }
  const now = nowIso();
  const onboarding = {
    ...(data.consumerOnboarding || {}),
    version: ONBOARDING_VERSION,
    currentStage: 'complete',
    completedAt: data.consumerOnboarding?.completedAt || now,
    updatedAt: now,
  };
  await ref.set(
    {
      consumerOnboarding: onboarding,
      updatedAt: now,
    },
    { merge: true },
  );
  return buildOnboardingBootstrap(
    userId,
    { ...data, consumerOnboarding: onboarding, updatedAt: now },
    authRecord,
  );
}

export const onboardingConstants = {
  version: ONBOARDING_VERSION,
  minimumTastes: MIN_TASTES,
  validTastes: [...VALID_TASTES],
  validIntents: [...VALID_INTENTS],
};
