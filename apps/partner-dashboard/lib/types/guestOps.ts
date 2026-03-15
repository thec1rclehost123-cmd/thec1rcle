/**
 * Shared TypeScript types for Venue Guest Operations.
 * Used by both server lib files and client components.
 */

// ── Enums ────────────────────────────────────────────────────────────────────

export type GuestType =
    | 'ticketed'
    | 'guest_list'
    | 'comp'
    | 'vip'
    | 'table'
    | 'host_manual'
    | 'promoter_manual'
    | 'staff_added';

export type GuestSource =
    | 'ticket_purchase'
    | 'venue_manual'
    | 'venue_comp'
    | 'venue_vip'
    | 'host_manual'
    | 'promoter_manual'
    | 'promoter_link_purchase'
    | 'table_booking'
    | 'imported_list'
    | 'staff_override';

export type GuestStatus =
    | 'expected'
    | 'checked_in'
    | 'denied'
    | 'flagged'
    | 'no_show'
    | 'pending_approval'
    | 'removed';

export type DoorStatus = 'open' | 'soft_close' | 'hard_close' | 'cutoff';

export type CheckInSource = 'scanner' | 'manual_dashboard' | 'offline_replay';

export type ScanResult =
    | 'valid'
    | 'already_scanned'
    | 'invalid'
    | 'cancelled'
    | 'not_found'
    | 're_entry';

export type OverrideAction =
    | 'manual_check_in'
    | 'undo_check_in'
    | 'deny_entry'
    | 'flag_guest'
    | 'add_guest'
    | 'remove_guest'
    | 'edit_notes'
    | 'add_comp'
    | 'add_vip'
    | 'edit_rules'
    | 'edit_allocation'
    | 're_entry'
    | 'export_requested'
    | 'resolve_exception';

export type ExceptionType =
    | 'duplicate_scan'
    | 'invalid_ticket'
    | 'cancelled_ticket_scan'
    | 'guest_not_found'
    | 'name_mismatch'
    | 'phone_mismatch'
    | 'host_over_allocation'
    | 'promoter_over_allocation'
    | 'manual_add_cap_exceeded'
    | 'capacity_hard_limit'
    | 're_entry_blocked';

export type ExceptionStatus = 'open' | 'resolved' | 'dismissed' | 'escalated';

export type DenyReason =
    | 'underage'
    | 'inappropriate_behavior'
    | 'dress_code'
    | 'capacity_full'
    | 'reservation_issue'
    | 'security_concern'
    | 'other_specify';

export type ExportFormat = 'csv' | 'json';
export type ExportPiiLevel = 'no_pii' | 'masked' | 'full';

// ── Core Records ─────────────────────────────────────────────────────────────

export interface GuestRecord {
    guestId: string;
    eventId: string;
    venueId: string;

    // Guest info (masking applied server-side by role)
    firstName?: string;           // OWNER/MANAGER only
    lastName?: string;            // OWNER/MANAGER only
    displayName: string;          // first + last initial — all roles
    maskedPhone?: string;         // STAFF/SECURITY+
    fullPhone?: string;           // OWNER/MANAGER only

    // Classification
    guestType: GuestType;
    source: GuestSource;
    status: GuestStatus;

    // Ticket linkage
    ticketId?: string;
    orderId?: string;
    ticketTierId?: string;
    ticketTierName?: string;

    // Attribution
    tableId?: string;
    tableName?: string;
    hostId?: string;
    hostName?: string;
    promoterId?: string;
    promoterName?: string;

    // Check-in state
    checkedIn: boolean;
    checkedInAt?: string;
    checkInSource?: CheckInSource;
    checkInDeviceId?: string;
    checkInDeviceName?: string;
    checkInOperator?: string;

    // Metadata
    addedByUid: string;
    addedByName: string;
    addedAt: string;
    updatedAt?: string;
    notes?: string;
    isRemoved: boolean;
    isLocked: boolean;
    quantity?: number;
}

export interface GuestSummary {
    eventId: string;
    venueId: string;
    totalExpected: number;
    ticketedGuests: number;
    guestListGuests: number;
    vipGuests: number;
    compGuests: number;
    tableGuests: number;
    checkedIn: number;
    notArrived: number;
    denied: number;
    flagged: number;
    duplicateScans: number;
    invalidScans: number;
    manualCheckIns: number;
    doorStatus: DoorStatus;
    lastUpdatedAt: string;
}

export interface ScannerSession {
    eventId: string;
    venueId: string;
    doorStatus: DoorStatus;
    sessionStartedAt: string;
    lastActivityAt: string;
    totalScans: number;
    validScans: number;
    duplicateScans: number;
    invalidScans: number;
    manualCheckIns: number;
    activeDeviceCount: number;
}

export interface ScannerDevice {
    deviceId: string;
    deviceName: string;
    operatorUid?: string;
    operatorName: string;
    operatorRole: string;
    boundGate?: string;
    isOnline: boolean;
    lastHeartbeat: string;
    batteryLevel?: number;
    validScans: number;
    duplicateScans: number;
    invalidScans: number;
    lastScanAt?: string;
    lastScanResult?: string;
    pairedAt: string;
}

export interface ScanEvent {
    scanId: string;
    eventId: string;
    venueId: string;
    orderId?: string;
    ticketId?: string;
    guestId?: string;
    guestDisplayName: string;
    guestType?: GuestType;
    result: ScanResult;
    source: CheckInSource | 'offline_replay';
    scannedAt: string;
    deviceId?: string;
    deviceName?: string;
    operatorUid?: string;
    operatorName?: string;
    gate?: string;
    ticketTierId?: string;
    ticketTierName?: string;
}

export interface GuestRules {
    eventId: string;
    venueId: string;
    entryCutoffEnabled: boolean;
    entryCutoffTime?: string;
    reEntryEnabled: boolean;
    reEntryWindowMins?: number;
    minimumAgeRule?: number;
    dressCodNote?: string;
    compApprovalRequired: boolean;
    vipApprovalRequired: boolean;
    manualAddCap: number;
    staffAddCap: number;
    manualCheckInEnabled: boolean;
    manualOverrideRequiresReason: boolean;
    exportEnabled: boolean;
    exportFormat: ExportFormat;
    exportPiiLevel: ExportPiiLevel;
    isLocked: boolean;
    lockedAt?: string;
    lockedBy?: string;
    updatedAt: string;
    updatedBy: string;
}

export interface GuestAllocation {
    hostId?: string;
    promoterId?: string;
    name: string;           // hostName or promoterName
    allocatedCount: number;
    usedCount: number;
    remaining: number;
    notes?: string;
    setByUid: string;
    setAt: string;
    updatedAt: string;
}

export interface ExceptionRecord {
    exceptionId: string;
    eventId: string;
    venueId: string;
    type: ExceptionType;
    guestId?: string;
    guestDisplayName?: string;
    triggeredBy: string;
    triggeredByName: string;
    triggeredAt: string;
    context?: Record<string, unknown>;
    status: ExceptionStatus;
    resolution?: {
        resolvedBy: string;
        resolvedByName: string;
        resolvedAt: string;
        action: 'allowed_entry' | 'denied' | 'dismissed' | 'escalated';
        reason: string;
        notes?: string;
    };
    isLocked: boolean;
}

export interface OverrideLog {
    overrideId: string;
    eventId: string;
    venueId: string;
    action: OverrideAction;
    actorUid: string;
    actorName: string;
    actorRole: string;
    targetGuestId: string;
    targetGuestName: string;
    reason?: string;
    overrideAt: string;
    metadata?: Record<string, unknown>;
}

// ── API Request / Response shapes ─────────────────────────────────────────────

export interface GuestOpsOverview {
    eventId: string;
    eventTitle: string;
    eventDate: string;
    eventStatus: string;
    doorStatus: DoorStatus;
    kpis: Omit<GuestSummary, 'eventId' | 'venueId' | 'lastUpdatedAt'> & { scanRatePer5min: number; onlineDevices: number; };
    isLocked: boolean;
    entryWindowOpen: boolean;
}

export interface GuestFilter {
    status?: GuestStatus | 'all';
    guestType?: GuestType | 'all';
    source?: GuestSource | 'all';
    checkedIn?: boolean;
    hostId?: string;
    promoterId?: string;
}

export interface GuestSort {
    field: 'addedAt' | 'checkedInAt' | 'displayName' | 'status';
    dir: 'asc' | 'desc';
}

export interface AddGuestBody {
    name: string;
    phone?: string;
    guestType: 'venue_manual' | 'venue_comp' | 'venue_vip' | 'table_booking' | 'host_manual' | 'promoter_manual';
    tableId?: string;
    hostId?: string;
    promoterId?: string;
    notes?: string;
    quantity?: number;
}

export interface CheckInBody {
    reason?: string;
    gate?: string;
}

export interface DenyBody {
    reason: DenyReason;
    notes?: string;
}

export interface FlagBody {
    reason: string;
    severity: 'low' | 'medium' | 'high';
    notes?: string;
}

export interface ResolveExceptionBody {
    action: 'allowed_entry' | 'denied' | 'dismissed' | 'escalated';
    reason: string;
    notes?: string;
}
