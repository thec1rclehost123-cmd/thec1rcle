export function listReceivedLikes(db: any, userId: string): Promise<any>;

export function respondToLikeRequest(
  db: any,
  userId: string,
  likeId: string,
  payload: { action: 'accept' | 'reject' },
): Promise<any>;

export function getDiscoverProfiles(db: any, userId: string): Promise<any>;
export function processSwipeAction(db: any, userId: string, targetUserId: string, action: 'like' | 'pass'): Promise<{ match: boolean; conversationId?: string }>;
export function getPublicUserProfile(db: any, targetUserId: string): Promise<any>;
export function getUserMatches(db: any, userId: string): Promise<any>;
