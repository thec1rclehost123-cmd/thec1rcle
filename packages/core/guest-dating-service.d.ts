export function listReceivedLikes(db: any, userId: string): Promise<any>;

export function respondToLikeRequest(
  db: any,
  userId: string,
  likeId: string,
  payload: { action: 'accept' | 'reject' },
): Promise<any>;

export function getDiscoverProfiles(
  db: any,
  userId: string,
  options?: { cursor?: string | null },
): Promise<{ profiles: any[]; nextCursor: string | null; hasMore: boolean; limit: number }>;
export function processSwipeAction(
  db: any,
  userId: string,
  targetUserId: string,
  action: 'like' | 'pass' | 'askOut',
  options?: { eventId?: string | null; message?: string | null },
): Promise<{
  match: boolean;
  conversationId?: string;
  subscription?: any;
  usage?: any;
  limits?: any;
  askOut?: boolean;
}>;
export function getPublicUserProfile(db: any, targetUserId: string): Promise<any>;
export function getUserMatches(db: any, userId: string): Promise<any>;
