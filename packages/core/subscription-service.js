export const SUBSCRIPTION_TIERS = Object.freeze({
  FREE: 'free',
  PREMIUM: 'premium',
});

export const PREMIUM_REQUIRED_CODE = 'PREMIUM_REQUIRED';
export const DAILY_USAGE_DOC_ID = 'dailyStats';
export const DEFAULT_SUBSCRIPTION_TIME_ZONE = 'Asia/Kolkata';

export const C1RCLE_PREMIUM_LIMITS = Object.freeze({
  free: Object.freeze({
    likesPerDay: 10,
    askOutsPerDay: 1,
    rewindsPerDay: 0,
    ticketTransfers: 1,
    bookingFeesWaived: false,
    readReceipts: false,
    advancedFilters: ['distance', 'age'],
    whoLikedMeVisibility: 'blurred',
    supportQueue: 'standard',
  }),
  premium: Object.freeze({
    likesPerDay: null,
    askOutsPerDay: 5,
    rewindsPerDay: null,
    ticketTransfers: null,
    bookingFeesWaived: true,
    readReceipts: true,
    advancedFilters: ['distance', 'age', 'vibeTags', 'intent', 'height', 'verifiedOnly'],
    whoLikedMeVisibility: 'full',
    supportQueue: 'priority',
  }),
});

export class PremiumRequiredError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'PremiumRequiredError';
    this.code = PREMIUM_REQUIRED_CODE;
    this.details = details;
  }
}

export function isPremiumRequiredError(error) {
  return error?.code === PREMIUM_REQUIRED_CODE || error instanceof PremiumRequiredError;
}

export function buildDefaultSubscription(now = new Date().toISOString()) {
  return {
    tier: SUBSCRIPTION_TIERS.FREE,
    status: 'inactive',
    expiresAt: null,
    updatedAt: now,
  };
}

function toDate(value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value?.toDate === 'function') {
    const date = value.toDate();
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === 'object' && typeof value.seconds === 'number') {
    const date = new Date(value.seconds * 1000);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toIso(value) {
  const date = toDate(value);
  return date ? date.toISOString() : null;
}

function isFuture(value, now = new Date()) {
  const date = toDate(value);
  return !date || date.getTime() > now.getTime();
}

function getProfileTimeZone(profile = {}) {
  return (
    profile.timeZone ||
    profile.timezone ||
    profile.localeTimeZone ||
    profile.location?.timeZone ||
    DEFAULT_SUBSCRIPTION_TIME_ZONE
  );
}

export function getLocalDateKey(date = new Date(), timeZone = DEFAULT_SUBSCRIPTION_TIME_ZONE) {
  try {
    const parts = new Intl.DateTimeFormat('en', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const valueByType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${valueByType.year}-${valueByType.month}-${valueByType.day}`;
  } catch {
    return date.toISOString().slice(0, 10);
  }
}

function getApproxResetAtIso(date = new Date(), timeZone = DEFAULT_SUBSCRIPTION_TIME_ZONE) {
  const key = getLocalDateKey(date, timeZone);
  const [year, month, day] = key.split('-').map((part) => Number(part));
  const next = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0));
  return next.toISOString();
}

export function normalizeSubscription(profile = {}, now = new Date()) {
  const raw = profile.subscription || profile.membership || {};
  const rawTier = String(raw.tier || profile.subscriptionTier || '').toLowerCase();
  const rawStatus = String(
    raw.status || profile.subscriptionStatus || profile.membershipStatus || '',
  ).toLowerCase();
  const expiresAt = raw.expiresAt ?? profile.subscriptionExpiresAt ?? profile.premiumExpiresAt;
  const legacyPremium =
    profile.isPremium === true ||
    profile.c1rclePlus === true ||
    raw.isPremium === true ||
    rawStatus === 'active' ||
    rawStatus === 'trialing';

  const premium =
    (rawTier === SUBSCRIPTION_TIERS.PREMIUM || legacyPremium) && isFuture(expiresAt, now);
  const tier = premium ? SUBSCRIPTION_TIERS.PREMIUM : SUBSCRIPTION_TIERS.FREE;

  return {
    tier,
    isPremium: tier === SUBSCRIPTION_TIERS.PREMIUM,
    status: rawStatus || (tier === SUBSCRIPTION_TIERS.PREMIUM ? 'active' : 'inactive'),
    expiresAt: toIso(expiresAt),
    limits: C1RCLE_PREMIUM_LIMITS[tier],
    supportQueue: C1RCLE_PREMIUM_LIMITS[tier].supportQueue,
  };
}

export function isPremiumProfile(profile = {}) {
  return normalizeSubscription(profile).isPremium;
}

function normalizeUsage(data = {}, dateKey, timeZone) {
  const sameDate = data.date === dateKey;
  return {
    date: dateKey,
    timeZone,
    likesUsed: sameDate ? Math.max(0, Number(data.likesUsed ?? data.likes ?? 0)) : 0,
    askOutsUsed: sameDate ? Math.max(0, Number(data.askOutsUsed ?? data.askOuts ?? 0)) : 0,
    resetAt: getApproxResetAtIso(new Date(), timeZone),
  };
}

function publicContext(context) {
  const { usageRef: _usageRef, userRef: _userRef, ...safe } = context;
  return safe;
}

export function getUsageFeatureLimit(subscription, feature) {
  const limits = C1RCLE_PREMIUM_LIMITS[subscription?.tier || SUBSCRIPTION_TIERS.FREE];
  if (feature === 'like') return limits.likesPerDay;
  if (feature === 'askOut') return limits.askOutsPerDay;
  if (feature === 'rewind') return limits.rewindsPerDay;
  return null;
}

export async function getSubscriptionContextForTransaction(
  db,
  transaction,
  userId,
  { now = new Date(), resetUsage = true } = {},
) {
  if (!db || !userId) throw new Error('db and userId are required');
  const userRef = db.collection('users').doc(userId);
  const userDoc = await transaction.get(userRef);
  const profile = userDoc.exists ? { id: userDoc.id, ...(userDoc.data() || {}) } : {};
  const subscription = normalizeSubscription(profile, now);
  const timeZone = getProfileTimeZone(profile);
  const dateKey = getLocalDateKey(now, timeZone);
  const usageRef = userRef.collection('usage').doc(DAILY_USAGE_DOC_ID);
  const usageDoc = await transaction.get(usageRef);
  const usage = normalizeUsage(usageDoc.exists ? usageDoc.data() || {} : {}, dateKey, timeZone);

  if (resetUsage && (!usageDoc.exists || usageDoc.data()?.date !== dateKey)) {
    transaction.set(
      usageRef,
      {
        ...usage,
        likesUsed: 0,
        askOutsUsed: 0,
        updatedAt: now.toISOString(),
      },
      { merge: true },
    );
  }

  return {
    userId,
    subscription,
    limits: subscription.limits,
    usage,
    userRef,
    usageRef,
  };
}

export async function getUserSubscriptionContext(db, userId) {
  return db.runTransaction(async (transaction) => {
    const context = await getSubscriptionContextForTransaction(db, transaction, userId);
    return publicContext(context);
  });
}

export function incrementUsageInTransaction(transaction, context, feature, now = new Date()) {
  const limit = getUsageFeatureLimit(context.subscription, feature);
  const usageKey = feature === 'askOut' ? 'askOutsUsed' : 'likesUsed';
  const used = Number(context.usage[usageKey] || 0);

  if (limit !== null && used >= limit) {
    throw new PremiumRequiredError(
      feature === 'askOut'
        ? 'C1RCLE Premium required for more Ask Out requests today.'
        : 'C1RCLE Premium required for more Likes today.',
      {
        feature,
        tier: context.subscription.tier,
        limit,
        used,
        usage: context.usage,
        resetAt: context.usage.resetAt,
      },
    );
  }

  const nextUsage = {
    ...context.usage,
    [usageKey]: used + 1,
  };

  transaction.set(
    context.usageRef,
    {
      date: nextUsage.date,
      timeZone: nextUsage.timeZone,
      likesUsed: nextUsage.likesUsed,
      askOutsUsed: nextUsage.askOutsUsed,
      resetAt: nextUsage.resetAt,
      updatedAt: now.toISOString(),
    },
    { merge: true },
  );

  return {
    ...context,
    usage: nextUsage,
  };
}

export async function consumeDailyUsage(db, userId, feature) {
  return db.runTransaction(async (transaction) => {
    const context = await getSubscriptionContextForTransaction(db, transaction, userId);
    const updated = incrementUsageInTransaction(transaction, context, feature);
    return publicContext(updated);
  });
}

function getPremiumEarlyAccessUntil(event = {}) {
  const earlyAccess = event.earlyAccess || {};
  return (
    event.premiumEarlyAccessUntil ||
    event.earlyAccessUntil ||
    event.publicSaleStartsAt ||
    earlyAccess.premiumUntil ||
    earlyAccess.endsAt ||
    earlyAccess.publicSaleStartsAt ||
    null
  );
}

function hasPremiumEarlyAccess(event = {}) {
  const earlyAccess = event.earlyAccess || {};
  return Boolean(
    event.hotDrop === true ||
    event.isHotDrop === true ||
    event.hasPremiumEarlyAccess === true ||
    event.premiumEarlyAccess === true ||
    earlyAccess.premium === true ||
    earlyAccess.tier === SUBSCRIPTION_TIERS.PREMIUM,
  );
}

export function isPremiumEarlyAccessActive(event = {}, now = new Date()) {
  if (!hasPremiumEarlyAccess(event)) return false;
  const until = toDate(getPremiumEarlyAccessUntil(event));
  return Boolean(until && until.getTime() > now.getTime());
}

export async function assertCanCheckoutEvent(db, userId, event, { now = new Date() } = {}) {
  const context = await getUserSubscriptionContext(db, userId);
  if (context.subscription.isPremium) return context;

  if (event?.isPremiumOnly === true) {
    throw new PremiumRequiredError('This event is exclusive to C1RCLE Premium.', {
      feature: 'premiumOnlyEvent',
      tier: context.subscription.tier,
      eventId: event.id || null,
    });
  }

  if (isPremiumEarlyAccessActive(event, now)) {
    throw new PremiumRequiredError('C1RCLE Premium gets early access to this drop.', {
      feature: 'earlyAccessDrop',
      tier: context.subscription.tier,
      eventId: event.id || null,
      earlyAccessUntil: toIso(getPremiumEarlyAccessUntil(event)),
    });
  }

  return context;
}

export async function getUserSubscriptionSummary(db, userId) {
  return getUserSubscriptionContext(db, userId);
}
