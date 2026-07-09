/**
 * Returns the full set of user IDs to exclude from feed/inbox/matches:
 *   (a) users the current user has blocked, plus
 *   (b) users who have blocked the current user (mutual blocking).
 *
 * Stored blocked lists come from two sources:
 *   - `users/{uid}/settings.blockedUsers`   (users I blocked)
 *   - `userBlocks` collection                 (users who blocked me — query by `blockedUid == myUid`)
 */
export async function getMutualBlockedUserIds(fastify: any, uid: string): Promise<string[]> {
  const [userDoc, blocksSnapshot] = await Promise.all([
    fastify.db
      .collection('users')
      .doc(uid)
      .get()
      .catch(() => null),
    fastify.db
      .collection('userBlocks')
      .where('blockedUid', '==', uid)
      .get()
      .catch(() => null),
  ]);

  const blockedByMe: string[] = userDoc?.data()?.settings?.blockedUsers || [];
  const blockedByOthers: string[] = blocksSnapshot
    ? blocksSnapshot.docs.map((doc: any) => doc.data().blockerUid)
    : [];

  if (!blockedByMe.length && !blockedByOthers.length) return [];
  return [...new Set([...blockedByMe, ...blockedByOthers])];
}
