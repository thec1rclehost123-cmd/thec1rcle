// Event Social Layer - Core Types and Utilities
import { Timestamp } from "firebase/firestore";

// Event Lifecycle Phases
export type EventPhase = "PRE" | "LIVE" | "AFTER" | "ARCHIVED" | "EXPIRED";

// Entitlement types that grant chat access
export type EntitlementType =
    | "ticket_purchased"
    | "guestlist_approved"
    | "ticket_claimed"
    | "group_ticket_share"
    | "couple_ticket"
    | "host"
    | "venue";

// User's entitlement to an event
export interface EventEntitlement {
    id: string;
    userId: string;
    eventId: string;
    type: EntitlementType;
    status: "active" | "transferred" | "cancelled" | "expired";
    ticketTier?: string;
    orderId?: string;
    grantedAt: any; // Timestamp
    expiresAt?: any;
    // For group tickets
    groupId?: string;
    isGroupOwner?: boolean;
}

// Event Social Config
export interface EventSocialConfig {
    eventId: string;
    groupChatEnabled: boolean;
    privateDMsEnabled: boolean;
    matchingEnabled: boolean;
    // Phase timing (all in days relative to event date)
    preEventDays: number; // Default: 7
    postEventDays: number; // Default: 7
    // Moderation
    hostModeration: boolean;
    venueAnnouncements: boolean;
}

// Chat participant profile (what others see)
export interface ChatParticipant {
    id: string;
    userId: string;
    displayName: string;
    avatar?: string;
    badge?: "host" | "venue" | "vip" | "promoter";
    joinedAt: any;
    isOnline?: boolean;
    lastSeen?: any;
}

// Group chat message
export interface GroupMessage {
    id: string;
    eventId: string;
    senderId: string;
    senderName: string;
    senderAvatar?: string;
    senderBadge?: string;
    content: string;
    type: "text" | "image" | "announcement" | "system";
    isAnonymous?: boolean;
    createdAt: any;
    isDeleted?: boolean;
    deletedBy?: string;
    replyTo?: string;
    reactions?: Record<string, string[]>; // emoji: [userIds]
}

// Private DM conversation
export interface PrivateConversation {
    id: string;
    eventId: string;
    participants: [string, string]; // Two user IDs
    status: "pending" | "accepted" | "declined" | "blocked";
    initiatedBy: string;
    acceptedAt?: any;
    createdAt: any;
    lastMessage?: {
        content: string;
        senderId: string;
        createdAt: any;
    };
    // Lifecycle
    expiresAt?: any;
    isSaved?: boolean; // If true, persists beyond event
}

// DM message
export interface DirectMessage {
    id: string;
    conversationId: string;
    senderId: string;
    content: string;
    type: "text" | "image";
    createdAt: any;
    readAt?: any;
    recipientId: string; // Recipient for unread count tracking
    reactions?: Record<string, string[]>; // emoji: [userIds]
}

export interface DirectMessageUnreadCount {
    conversationId: string;
    count: number;
}

// Block record
export interface UserBlock {
    id: string;
    blockerId: string;
    blockedId: string;
    eventId?: string; // If blocking within specific event
    isGlobal: boolean; // If true, blocks across all events
    reason?: string;
    createdAt: any;
}

// Report record
export interface UserReport {
    id: string;
    reporterId: string;
    reportedId: string;
    eventId?: string;
    messageId?: string;
    category: "harassment" | "spam" | "inappropriate" | "safety" | "other";
    description?: string;
    status: "pending" | "reviewed" | "resolved" | "dismissed";
    createdAt: any;
    reviewedAt?: any;
    reviewedBy?: string;
    action?: "warned" | "muted" | "removed" | "banned";
}

// Saved contact (persists after event)
export interface SavedContact {
    id: string;
    userId: string;
    contactUserId: string;
    contactName: string;
    contactAvatar?: string;
    eventId: string;
    eventTitle: string;
    savedAt: any;
    note?: string;
}

// Matching profile (for optional dating layer)
export interface MatchingProfile {
    userId: string;
    eventId: string;
    isOptedIn: boolean;
    interests?: string[];
    lookingFor?: "networking" | "dating" | "friends" | "any";
    musicTaste?: string[];
    bio?: string;
    isVisible: boolean;
}

// Calculate event phase based on dates
export function getEventPhase(eventDate: Date): EventPhase {
    const now = new Date();
    const eventTime = eventDate.getTime();
    const nowTime = now.getTime();

    const dayInMs = 24 * 60 * 60 * 1000;
    const preEventStart = eventTime - (7 * dayInMs);

    // Assume event lasts 12 hours
    const eventEnd = eventTime + (12 * 60 * 60 * 1000);
    // Post-party window: 72 hours after event ends
    const postEventEnd = eventEnd + (72 * 60 * 60 * 1000);
    // Archive window: 7 days after post-party ends
    const archiveEnd = postEventEnd + (7 * 24 * 60 * 60 * 1000);

    if (nowTime < preEventStart) return "EXPIRED"; // Not yet active
    if (nowTime >= preEventStart && nowTime < eventTime) return "PRE";
    if (nowTime >= eventTime && nowTime < eventEnd) return "LIVE";
    if (nowTime >= eventEnd && nowTime < postEventEnd) return "AFTER";
    if (nowTime >= postEventEnd && nowTime < archiveEnd) return "ARCHIVED";

    return "EXPIRED";
}

// Get phase description for UI
export function getPhaseInfo(phase: EventPhase): {
    label: string;
    description: string;
    color: string;
    icon: string;
} {
    switch (phase) {
        case "PRE":
            return {
                label: "PRE",
                description: "Connect & coordinate before the party.",
                color: "#8B5CF6", // Purple
                icon: "✨",
            };
        case "LIVE":
            return {
                label: "LIVE",
                description: "Real-time updates & venue news.",
                color: "#F44A22", // C1RCLE orange
                icon: "🔥",
            };
        case "AFTER":
            return {
                label: "AFTER",
                description: "Relive the night, share photos & connect.",
                color: "#10B981", // Green
                icon: "📸",
            };
        case "ARCHIVED":
            return {
                label: "PAST",
                description: "Read-only archive.",
                color: "#6B7280", // Gray
                icon: "📁",
            };
        case "EXPIRED":
            return {
                label: "ENDED",
                description: "This chat has ended.",
                color: "#374151",
                icon: "🏁",
            };
    }
}

// Check if user can access event chat
export function canAccessEventChat(
    entitlement: EventEntitlement | null,
    phase: EventPhase
): { allowed: boolean; reason?: string } {
    if (!entitlement) {
        return { allowed: false, reason: "You need a ticket to join this chat" };
    }

    if (entitlement.status !== "active") {
        return { allowed: false, reason: "Your ticket is no longer valid" };
    }

    if (phase === "EXPIRED" || phase === "ARCHIVED") {
        return { allowed: false, reason: "This event chat has ended" };
    }

    return { allowed: true };
}

// Format time since for messages
export function formatTimeAgo(date: Date): string {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
}

// Get DM request status label
export function getDMStatusLabel(
    status: PrivateConversation["status"],
    isInitiator: boolean
): {
    label: string;
    chip: "Connected" | "Pending" | "Request received" | "Blocked" | "Declined";
    canChat: boolean;
} {
    switch (status) {
        case "pending":
            return isInitiator
                ? { label: "Awaiting acceptance", chip: "Pending", canChat: false }
                : { label: "Wants to connect", chip: "Request received", canChat: false };
        case "accepted":
            return { label: "Connected", chip: "Connected", canChat: true };
        case "declined":
            return { label: "Request declined", chip: "Declined", canChat: false };
        case "blocked":
            return { label: "Blocked", chip: "Blocked", canChat: false };
    }
}
