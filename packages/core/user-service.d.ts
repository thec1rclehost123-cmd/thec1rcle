export function syncAuthUser(
  db: any,
  userId: string,
  authRecord?: any,
  options?: { auth?: any } | Record<string, any>,
): Promise<any>;
export function registerDeviceToken(
  db: any,
  userId: string,
  payload?: Record<string, any>,
): Promise<any>;
export function listUserFollows(
  db: any,
  userId: string,
): Promise<{ venueIds: string[]; hostIds: string[] }>;
export function submitVerificationAttempt(
  db: any,
  userId: string,
  payload?: Record<string, any>,
): Promise<any>;
export function getPrivateProfile(db: any, userId: string): Promise<any>;
export function updateProfile(db: any, userId: string, updates: Record<string, any>): Promise<any>;
export function blockUser(
  db: any,
  userId: string,
  targetUserId: string,
): Promise<{ success: boolean; blockedUsers: string[] }>;
export function softDeleteUser(db: any, userId: string): Promise<{ success: boolean }>;
