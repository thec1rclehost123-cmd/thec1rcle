import type { VenueRole, HostRole, PromoterRole } from "@/lib/rbac/types";

// GET /api/auth/session
export interface SessionDTO {
    uid: string;
    email: string;
    displayName: string;
    partnerType: "venue" | "host" | "promoter" | null;
    isApproved: boolean;
    onboardingStatus: "pending" | "changes_requested" | "rejected" | null;
}

// GET /api/venue/overview/summary
export interface VenueOverviewSummaryDTO {
    venueId: string;
    weekendRevenue: number;
    activeEventsCount: number;
    avgEntryVelocity: string;
    asOf: string; // ISO timestamp
}

// GET /api/venue/overview/tonight
export interface VenueTonightDTO {
    id: string;
    eventId: string;
    eventName: string;
    checkedIn: number;
    expected: number;
    confirmed: number;
    guestlistCount: number;
    promotersCount: number;
    revenue: number;
    ticketsSold: number;
}

// GET /api/venue/notifications (list item)
export interface VenueNotificationDTO {
    id: string;
    type: "partnership_request" | "event_update" | "security_alert" | "staff_invite" | "host_request" | "promoter_request" | "reservation" | "revenue" | "payment" | string;
    title: string;
    body?: string;
    description?: string;
    actionable: boolean;
    timestamp?: string;
    createdAt?: string; // ISO
    isRead: boolean;
}

// GET /api/venue/staff (list item)
export interface VenueStaffMemberDTO {
    id: string;
    name: string;
    /** Only populated for OWNER/MANAGER callers */
    email?: string;
    role: VenueRole;
    status: "active" | "invited" | "suspended" | "removed";
    joinedAt: string; // ISO
}

// Audit log entry written to audit_logs/{venueId}/entries/{autoId}
export interface AuditLogEntry {
    actorId: string;
    venueId: string;
    action: string;
    entityType: string;
    entityId: string;
    timestamp: string; // ISO, server-generated
    result: "success" | "failure";
    metadata?: Record<string, unknown>;
}
