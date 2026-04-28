export function normalizeRegistrationDetails(detailsOrName, gender, age) {
  if (detailsOrName && typeof detailsOrName === "object") return detailsOrName;
  return {
    displayName: detailsOrName,
    gender,
    age: parseInt(age, 10) || age,
  };
}

export function normalizeBootstrapPayload(data) {
  const identity = data?.identity || {};
  const profile = data?.profile || data?.user || null;
  const providerId = identity?.providerId || null;

  return {
    bootstrap: data || null,
    user: identity?.uid
      ? {
          uid: identity.uid,
          email: identity.email || "",
          displayName: identity.displayName || profile?.displayName || "Member",
          photoURL: identity.photoURL || profile?.photoURL || profile?.avatar || "",
          phoneNumber: identity.phoneNumber || profile?.phone || profile?.phoneNumber || "",
          emailVerified: identity.emailVerified === true,
          providerId,
          providerData: providerId ? [{ providerId }] : [],
        }
      : null,
    profile,
    unreadNotificationCount: data?.shell?.unreadNotificationCount || 0,
  };
}

export function buildUpdatedEventList(profile, field, eventId, shouldInclude) {
  const current = new Set(profile?.[field] || []);
  if (shouldInclude) current.add(eventId);
  else current.delete(eventId);
  return Array.from(current);
}
