declare module '@c1rcle/core/scan-engine' {
    export function verifyScanSignature(payload: any): boolean;
    export function validateScannerDevice(db: any, deviceId: string, venueId: string): Promise<{ valid: boolean, error?: string, device?: any, ref?: any }>;
    export function recordScanAttempt(db: any, data: any): Promise<any>;
}

declare module '@c1rcle/core/ticket-engine' {
    export function signTicketId(ticketId: string): string;
    export function generateSecureToken(length?: number): string;
    export function validateBundle(bundle: any): { valid: boolean, reason?: string };
    export function validateTransfer(transfer: any, recipientId: string): { valid: boolean, reason?: string };
}

declare module '@c1rcle/core/staff-engine' {
    export const ROLE_PRESETS: Record<string, any>;
    export function hasStaffPermission(db: any, venueId: string, userId: string, permission: string): Promise<boolean>;
    export function addStaffMember(db: any, payload: any, actor: any): Promise<any>;
    export function linkStaffUser(db: any, staffId: string, userId: string): Promise<void>;
    export function listStaff(db: any, venueId: string, isActive?: boolean): Promise<any[]>;
    export function updateStaff(db: any, staffId: string, updates: any, actor: any): Promise<void>;
}

declare module '@c1rcle/core/profile-engine' {
    export const PROFILE_SAFE_FIELDS: string[];
    export function filterSafeProfileUpdates(updates: any): any;
}

declare module '@c1rcle/core/api-client' {
    export interface ApiClientConfig {
        baseUrl?: string;
        getAuthToken?: () => Promise<string | null>;
        onUnauthorized?: () => void;
    }

    export class C1rcleApiClient {
        constructor(config: ApiClientConfig);
        request<T = any>(path: string, options?: any): Promise<T>;
        getEvents(params?: any): Promise<any>;
        reserveTickets(payload: any): Promise<any>;
        calculatePricing(payload: any): Promise<any>;
        initiateCheckout(payload: any): Promise<any>;
        verifyPayment(payload: any): Promise<any>;
        processScan(payload: any): Promise<any>;
        getScanHistory(eventId: string, limit?: number): Promise<any>;
        initiateTransfer(ticketId: string, recipientEmail?: string): Promise<any>;
        claimTicket(transferToken: string): Promise<any>;
        getMyTickets(): Promise<any>;
        getStaffPermissions(venueId: string): Promise<any>;
        inviteStaff(payload: any): Promise<any>;
        getProfile(id: string, type?: string): Promise<any>;
        updateProfile(type: string, updates: any, id?: string): Promise<any>;
        getFinancialSummary(entityId: string, type?: string): Promise<any>;
        getTransactionHistory(entityId: string, limit?: number, state?: string): Promise<any>;
        processRefund(orderId: string, amount: number, reason: string): Promise<any>;
        getPromoterConnections(entityId: string, entityType: string, status?: string): Promise<any>;
        manageConnection(action: string, data: any): Promise<any>;
        getPromoterStats(id: string): Promise<any>;
        generatePromoterLink(promoterId: string, eventId: string): Promise<any>;

        // Phase 9: Analytics, Tables, Waitlist, Search
        getAnalytics(id: string, type?: string, range?: string): Promise<any>;
        getFloorPlan(venueId: string): Promise<any>;
        updateMasterTable(venueId: string, tableData: any): Promise<any>;
        assignTable(eventId: string, tableId: string, bookingId: string, status?: string): Promise<any>;
        getEventAssignments(eventId: string): Promise<any[]>;
        joinWaitlist(data: any): Promise<any>;
        processWaitlist(eventId: string, tierId: string): Promise<any>;
        verifyWaitlistAccess(eventId: string, email: string): Promise<any>;
        search(q: string, filters?: any): Promise<any>;

        // Phase 10: Calendar & Promos
        getVenueAvailability(venueId: string, start: string, end: string): Promise<any[]>;
        blockVenueDate(venueId: string, date: string, reason: string, startTime?: string | null, endTime?: string | null): Promise<any>;
        requestSlot(data: any): Promise<any>;
        respondToSlot(id: string, action: string, responseData?: any): Promise<any>;
        getEventPromos(eventId: string): Promise<any[]>;
        validatePromo(eventId: string, code: string, userId?: string | null, items?: any[]): Promise<any>;
        getPromoterPayoutBalance(promoterId: string): Promise<any>;
        requestPromoterPayout(amount: number, paymentMethod: string, paymentDetails: any, promoterId?: string | null): Promise<any>;
    }
}

declare module '@c1rcle/core/event-engine' {
    export function calculateHeatScore(event: any): number;
    export function resolveStartingPrice(event: any): number;
    export function determineStatus(start: string, end: string): string;
    export function buildEvent(payload?: any): any;
    export function filterAndSortEvents(events: any[], options?: any): any[];
    export const EVENT_SORTERS: Record<string, any>;
}

declare module '@c1rcle/core/events' {
    export const EVENT_LIFECYCLE: Record<string, string>;
    export const PUBLIC_LIFECYCLE_STATES: string[];
    export function normalizeCity(city?: string, location?: string): string;
    export function getCityLabel(cityKey: string): string;
    export function resolvePoster(payload: any): string;
    export function mapEventForClient(data: any, id: string): any;
    export function isPublicLifecycle(lifecycle: string): boolean;
    export function isUpcomingLifecycle(lifecycle: string): boolean;
    export function requiresVenueApproval(event: any): boolean;
    export function canPromoterSee(event: any): boolean;
    export function canPromoterCreateLink(event: any): boolean;
    export function isEditableEvent(event: any, role: string): boolean;
}



declare module '@c1rcle/core/finance-engine' {
    export function getFinancialSummary(entityId: string, type?: string): Promise<any>;
    export function getTransactionHistory(entityId: string, options?: any): Promise<any[]>;
    export function processRefund(orderId: string, amount: number, reason: string): Promise<any>;
}

declare module '@c1rcle/core/promoter-engine' {
    export function manageConnection(action: string, data: any): Promise<any>;
    export function generatePromoterLink(promoterId: string, eventId: string): Promise<any>;
    export function getPromoterStats(promoterId: string): Promise<any>;
    export function listConnections(entityId: string, entityType: string, status?: string): Promise<any[]>;
}

declare module '@c1rcle/core/analytics-engine' {
    export function getVenueAnalytics(venueId: string, range?: string): Promise<any>;
    export function getHostAnalytics(hostId: string): Promise<any>;
    export function getPromoterFunnel(promoterId: string): Promise<any>;
}

declare module '@c1rcle/core/table-engine' {
    export function getFloorPlan(venueId: string): Promise<any[]>;
    export function updateMasterTable(venueId: string, tableData: any): Promise<any>;
    export function assignTable(eventId: string, tableId: string, bookingId: string, status?: string): Promise<any>;
    export function getEventAssignments(eventId: string): Promise<any[]>;
}

declare module '@c1rcle/core/waitlist-engine' {
    export function joinWaitlist(data: { eventId: string, tierId?: string, userId?: string, email: string, phone?: string }): Promise<any>;
    export function processWaitlist(eventId: string, tierId: string): Promise<any>;
    export function verifyWaitlistAccess(eventId: string, email: string): Promise<{ valid: boolean, entry?: any }>;
}

declare module '@c1rcle/core/calendar-engine' {
    export function getVenueAvailability(venueId: string, startDate: string, endDate: string): Promise<any[]>;
    export function blockDate(venueId: string, date: string, reason: string, blockedBy: any, startTime?: string, endTime?: string): Promise<any>;
    export function unblockDate(venueId: string, date: string): Promise<any>;
    export function createSlotRequest(data: any): Promise<any>;
    export function respondToSlotRequest(id: string, action: string, responseData: any, actor: any): Promise<any>;
}

declare module '@c1rcle/core/payout-engine' {
    export function settleEvent(eventId: string): Promise<any>;
    export function getEligibleEventsForSettlement(options?: any): Promise<any[]>;
    export function processPartnerPayout(partnerId: string, partnerType: string): Promise<any>;
    export function getPromoterPayoutBalance(promoterId: string): Promise<any>;
    export function requestPromoterPayout(data: { promoterId: string, amount: number, paymentMethod: string, paymentDetails: any }): Promise<any>;
}

declare module '@c1rcle/core/promo-service' {
    export function createPromoCode(eventId: string, codeData: any, createdBy: any): Promise<any>;
    export function getPromoCodeByCode(eventId: string, code: string): Promise<any>;
    export function upsertPromoCode(eventId: string, codeData: any, actor: any): Promise<any>;
    export function getPromoCodeById(promoCodeId: string): Promise<any>;
    export function getEventPromoCodes(eventId: string, options?: any): Promise<any[]>;
    export function validatePromoCode(eventId: string, code: string, userId: string, items: any[]): Promise<any>;
    export function recordRedemption(promoCodeId: string, orderId: string, userId: string, details?: any): Promise<any>;
}

declare module '@c1rcle/core/cms-engine' {
    export function syncGalleryToVenue(db: any, venueId: string): Promise<void>;
    export function syncMenuToVenue(db: any, venueId: string): Promise<void>;
    export function createHighlight(db: any, venueId: string, data: any, actorId: string): Promise<any>;
    export function updateHighlight(db: any, id: string, updates: any, actorId: string): Promise<void>;
    export function addGalleryPhoto(db: any, venueId: string, imageUrl: string, caption?: string): Promise<any>;
    export function initializeVenueFacilities(db: any, venueId: string): Promise<any[]>;
}


