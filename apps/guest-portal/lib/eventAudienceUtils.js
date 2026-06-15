function normalizeAudienceUser(user) {
  if (!user || typeof user !== 'object') return null;

  const id = user.id || user.uid || user.userId || user.guestId || null;
  const name =
    user.name || user.displayName || user.username || user.handle || user.fullName || null;

  if (!id && !name) return null;

  return {
    id: id || name,
    name: name || 'Guest',
    displayName: user.displayName || name || 'Guest',
    username: user.username || user.handle || null,
    avatar:
      user.avatar || user.photoURL || user.photoUrl || user.image || user.profileImage || null,
  };
}

export function selectInterestedUsersForDisplay(users = [], limit = 12) {
  const seen = new Set();
  const selected = [];

  for (const user of users) {
    const normalized = normalizeAudienceUser(user);
    if (!normalized) continue;
    if (seen.has(normalized.id)) continue;
    seen.add(normalized.id);
    selected.push(normalized);
    if (selected.length >= limit) break;
  }

  return selected;
}
