export function listReceivedLikes(db: any, userId: string): Promise<any>;

export function respondToLikeRequest(
  db: any,
  userId: string,
  likeId: string,
  payload: { action: 'accept' | 'reject' },
): Promise<any>;
