export function normalizeInterestedUserGender(value: any): "other" | "female" | "male";
export function selectInterestedUsersForDisplay(users?: any[], limit?: number): any[];
export function getEventInterested(db: any, eventId: any, limit?: number): Promise<any>;
export function toggleEventRsvp(db: any, { eventId, userId, shouldInclude }: {
    eventId: any;
    userId: any;
    shouldInclude: any;
}): Promise<{
    success: boolean;
}>;
export function trackGuestEventView(db: any, { eventId, viewerId }: {
    eventId: any;
    viewerId: any;
}): Promise<{
    ok: boolean;
}>;
export function trackGuestEventInteraction(db: any, { eventId, type, ref }: {
    eventId: any;
    type: any;
    ref: any;
}): Promise<{
    ok: boolean;
}>;
export function getEventSurgeStatus(db: any, eventId: any): Promise<any>;
export function joinEventQueue(db: any, { eventId, userId, deviceId }: {
    eventId: any;
    userId?: string | undefined;
    deviceId?: string | undefined;
}): Promise<any>;
export function getEventQueueStatus(db: any, queueId: any): Promise<any>;
export function joinEventWaitlist(db: any, { eventId, ticketId, tierId, userId, email, phone }: {
    eventId: any;
    ticketId: any;
    tierId: any;
    userId: any;
    email: any;
    phone: any;
}): Promise<any>;
export function getEventWaitlistStatus(db: any, { eventId, email }: {
    eventId: any;
    email: any;
}): Promise<any>;
export function verifyEventWaitlistAccess(db: any, { eventId, email }: {
    eventId: any;
    email: any;
}): Promise<any>;
