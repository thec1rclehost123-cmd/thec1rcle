export function ensureEventChatMembership(
  db: any,
  payload: {
    eventId: string;
    userId: string;
    userName?: string;
    userEmail?: string;
    userAvatar?: string | null;
    source?: string;
    orderId?: string | null;
  },
): Promise<any>;

export function hasActiveEventEntitlement(
  db: any,
  userId: string,
  eventId: string,
): Promise<boolean>;

export function listUserChats(
  db: any,
  userId: string,
  options?: { type?: 'all' | 'direct' | 'event'; limit?: number },
): Promise<any>;

export function getChatMessages(
  db: any,
  userId: string,
  chatId: string,
  options?: { limit?: number; before?: string | null },
): Promise<any>;

export function countApprovedEventMedia(db: any, eventId: string): Promise<number>;

export function sendChatMessage(
  db: any,
  userId: string,
  chatId: string,
  payload?: {
    text?: string | null;
    imageUrl?: string | null;
    type?: 'text' | 'image' | null;
    metadata?: Record<string, unknown>;
  },
): Promise<any>;

export function assertUserCanSendChatMessage(db: any, userId: string): Promise<any>;

export function reportChatMessage(
  db: any,
  userId: string,
  chatId: string,
  messageId: string,
  payload?: { reason?: string | null },
): Promise<any>;

export function reportSocialMessage(
  db: any,
  userId: string,
  payload: {
    messageId: string;
    senderId?: string | null;
    eventId?: string | null;
    conversationId?: string | null;
    chatId?: string | null;
    reason?: string | null;
    details?: string | null;
  },
): Promise<any>;

export function getEventAttendees(
  db: any,
  eventId: string,
  userId: string,
  options?: { limit?: number },
): Promise<any>;

export function archiveExpiredEventChats(
  db: any,
  options?: {
    now?: Date | string;
    olderThanHours?: number;
    limit?: number;
    dryRun?: boolean;
  },
): Promise<any>;
