/**
 * THE C1RCLE - Entitlement Engine Types
 */

export type EntitlementState = 'ISSUED' | 'ACTIVE' | 'CONSUMED' | 'REVOKED' | 'EXPIRED';

export interface Entitlement {
    id: string;
    eventId: string;
    orderId: string;
    ownerUserId: string;
    ticketType: 'paid' | 'free' | 'rsvp' | 'couple';
    genderConstraint?: 'male' | 'female' | 'none';
    scanCountAllowed: number;
    scanCountUsed: number;
    state: EntitlementState;
    issuedAt: string;
    consumedAt?: string | null;
    metadata: {
        claimSource?: string;
        transferHistory?: string[];
        couplePartnerId?: string;
        [key: string]: any;
    };
}

export type ScanResult = 'GRANTED' | 'DENIED';

export type DenialReason =
    | 'INVALID_QR'
    | 'STALE_QR'
    | 'ENTITLEMENT_NOT_FOUND'
    | 'ENTITLEMENT_NOT_ACTIVE'
    | 'ALREADY_CONSUMED'
    | 'GENDER_MISMATCH'
    | 'COUPLE_INCOMPLETE'
    | 'EVENT_MISMATCH'
    | 'CAPACITY_EXCEEDED'
    | 'TIME_WINDOW_INVALID';

export interface ScanLedgerEntry {
    scanId: string;
    entitlementId: string;
    eventId: string;
    scannerId: string;
    timestamp: string;
    result: ScanResult;
    reasonCode?: DenialReason;
    metadata?: Record<string, any>;
}
