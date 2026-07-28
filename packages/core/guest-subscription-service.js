export const FREE_SUBSCRIPTION_LIMITS = Object.freeze({
  likesPerDay: 10,
  askOutsPerDay: 1,
  rewindsPerDay: 0,
  ticketTransfers: 1,
  bookingFeesWaived: false,
  readReceipts: false,
  advancedFilters: Object.freeze(['distance', 'age']),
  whoLikedMeVisibility: 'blurred',
  supportQueue: 'standard',
});

export const PREMIUM_SUBSCRIPTION_LIMITS = Object.freeze({
  likesPerDay: null,
  askOutsPerDay: 5,
  rewindsPerDay: null,
  ticketTransfers: null,
  bookingFeesWaived: true,
  readReceipts: true,
  advancedFilters: Object.freeze([
    'distance',
    'age',
    'vibeTags',
    'intent',
    'height',
    'verifiedOnly',
  ]),
  whoLikedMeVisibility: 'full',
  supportQueue: 'priority',
});

function subscriptionError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === 'function') return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function utcDateKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function nextUtcReset(now = new Date()) {
  const reset = new Date(now);
  reset.setUTCHours(24, 0, 0, 0);
  return reset.toISOString();
}

export function resolveGuestSubscription(profile = {}, now = new Date()) {
  const subscription = profile.subscription || {};
  const explicitTier = String(subscription.tier || profile.subscriptionTier || '').toLowerCase();
  const status = String(subscription.status || profile.subscriptionStatus || '').toLowerCase();
  const expiresAt =
    subscription.expiresAt || profile.subscriptionExpiresAt || profile.premiumExpiresAt || null;
  const expiry = toDate(expiresAt);
  const isExpired = expiry ? expiry.getTime() <= now.getTime() : false;
  const activeStatus = ['active', 'trialing'].includes(status);
  const premiumFlag =
    profile.isPremium === true ||
    profile.c1rclePlus === true ||
    subscription.isPremium === true ||
    explicitTier === 'premium';
  const isPremium = premiumFlag && !isExpired && (activeStatus || status === '');

  return {
    tier: isPremium ? 'premium' : 'free',
    isPremium,
    status: isPremium ? status || 'active' : isExpired ? 'expired' : status || 'free',
    expiresAt: expiry ? expiry.toISOString() : null,
  };
}

export function buildGuestSubscriptionContext(profile = {}, usageRecord = {}, now = new Date()) {
  const subscription = resolveGuestSubscription(profile, now);
  const date = utcDateKey(now);
  return {
    subscription,
    usage: {
      date,
      timeZone: 'UTC',
      likesUsed: Math.max(0, Number(usageRecord.likesUsed ?? usageRecord.likes ?? 0) || 0),
      askOutsUsed: Math.max(0, Number(usageRecord.askOutsUsed ?? usageRecord.askOuts ?? 0) || 0),
      resetAt: nextUtcReset(now),
    },
    limits: subscription.isPremium ? PREMIUM_SUBSCRIPTION_LIMITS : FREE_SUBSCRIPTION_LIMITS,
  };
}

export async function getGuestSubscriptionContext(db, userId, now = new Date()) {
  if (!userId) throw subscriptionError('UNAUTHORIZED', 'Authentication required');
  const date = utcDateKey(now);
  const [userSnapshot, usageSnapshot] = await Promise.all([
    db.collection('users').doc(userId).get(),
    db.collection('userDailyLimits').doc(`${userId}_${date}`).get(),
  ]);
  if (!userSnapshot.exists) {
    throw subscriptionError('USER_NOT_FOUND', 'User profile not found');
  }
  return buildGuestSubscriptionContext(
    userSnapshot.data() || {},
    usageSnapshot.exists ? usageSnapshot.data() || {} : {},
    now,
  );
}

export function getDailyUsageDocumentId(userId, now = new Date()) {
  return `${userId}_${utcDateKey(now)}`;
}
