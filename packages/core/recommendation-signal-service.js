const MAX_RECENT_SIGNALS = 30;

function normalize(value, max = 120) {
  return String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_').slice(0, max);
}

function appendUnique(values, value) {
  if (!value) return values;
  return [value, ...values.filter((item) => item !== value)].slice(0, MAX_RECENT_SIGNALS);
}

/** Persist privacy-safe discovery signals; never accepts contact or coordinate data. */
export async function recordRecommendationSignal(db, userId, input, now = new Date().toISOString()) {
  if (!db || !userId) throw new Error('Database and userId are required');
  const ref = db.collection('users').doc(userId);
  const doc = await ref.get();
  if (!doc.exists) throw Object.assign(new Error('User not found'), { statusCode: 404 });

  const data = doc.data() || {};
  const discoveryProfile = data.discoveryProfile || {};
  const current = discoveryProfile.behaviorSignals || {};
  const type = normalize(input?.type, 40);
  const category = normalize(input?.category, 80);
  const eventId = String(input?.eventId || '').trim().slice(0, 160);
  const venueId = String(input?.venueId || '').trim().slice(0, 160);
  const next = {
    browsedCategories: appendUnique(Array.isArray(current.browsedCategories) ? current.browsedCategories : [], category),
    viewedEventIds: appendUnique(Array.isArray(current.viewedEventIds) ? current.viewedEventIds : [], type === 'event_view' ? eventId : ''),
    savedEventIds: appendUnique(Array.isArray(current.savedEventIds) ? current.savedEventIds : [], type === 'event_save' ? eventId : ''),
    followedVenueIds: appendUnique(Array.isArray(current.followedVenueIds) ? current.followedVenueIds : [], type === 'venue_follow' ? venueId : ''),
    updatedAt: now,
  };
  const withoutTimestamp = (value) => ({ ...value, updatedAt: undefined });
  const changed = JSON.stringify(withoutTimestamp(current)) !== JSON.stringify(withoutTimestamp(next));
  const profileVersion = Number(discoveryProfile.profileVersion || 1) + (changed ? 1 : 0);
  await ref.set(
    {
      discoveryProfile: { ...discoveryProfile, behaviorSignals: next, profileVersion, updatedAt: now },
      updatedAt: now,
    },
    { merge: true },
  );
  return { accepted: true, profileVersion, changed };
}

export const recommendationSignalConstants = { MAX_RECENT_SIGNALS };
