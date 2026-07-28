type FirebaseTokenUser = {
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
};

/**
 * Firebase already refreshes expired ID tokens. Normal dashboard API requests
 * must use that cached path instead of forcing a network refresh per request.
 */
export function getCachedFirebaseIdToken(user: FirebaseTokenUser | null | undefined) {
  if (!user) return Promise.resolve('');
  return user.getIdToken();
}
