// Event Social Layer - Core Types and Utilities
import { Timestamp } from "firebase/firestore";

// Event Lifecycle Phases
export type EventPhase = "pre-event" | "during" | "post-event" | "expired";

// Entitlement types that grant chat access
export type EntitlementType =
    | "ticket_purchased"
    | "guestlist_approved"
    | "ticket_claimed"
    | "group_ticket_share"
    | "couple_ticket";

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
    createdAt: any;
    isDeleted?: boolean;
    deletedBy?: string;
    replyTo?: string;
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
    isDeleted?: boolean;
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
    const postEventEnd = eventTime + (7 * dayInMs);

    if (nowTime < preEventStart) {
        return "expired"; // Too early, chat not active yet
    }

    if (nowTime >= preEventStart && nowTime < eventTime) {
        return "pre-event";
    }

    // During event - assume event lasts up to 12 hours from start
    const eventEnd = eventTime + (12 * 60 * 60 * 1000);
    if (nowTime >= eventTime && nowTime < eventEnd) {
        return "during";
    }

    if (nowTime >= eventEnd && nowTime < postEventEnd) {
        return "post-event";
    }

    return "expired";
}

// Get phase description for UI
export function getPhaseInfo(phase: EventPhase): {
    label: string;
    description: string;
    color: string;
    icon: string;
} {
    switch (phase) {
        case "pre-event":
            return {
                label: "Pre-Party",
                description: "Build the hype! Share what you're wearing, coordinate meetups.",
                color: "#8B5CF6", // Purple
                icon: "🎉",
            };
        case "during":
            return {
                label: "Live Now",
                description: "Real-time updates, find your crew, share the moment.",
                color: "#F44A22", // C1RCLE orange
                icon: "🔥",
            };
        case "post-event":
            return {
                label: "After Party",
                description: "Share photos, exchange contacts, relive the night.",
                color: "#10B981", // Green
                icon: "📸",
            };
        case "expired":
            return {
                label: "Archived",
                description: "This chat has ended. Saved contacts remain in your profile.",
                color: "#6B7280", // Gray
                icon: "📁",
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

    if (phase === "expired") {
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
export function getDMStatusLabel(status: PrivateConversation["status"]): {
    label: string;
    canChat: boolean;
} {
    switch (status) {
        case "pending":
            return { label: "Awaiting acceptance", canChat: false };
        case "accepted":
            return { label: "Connected", canChat: true };
        case "declined":
            return { label: "Request declined", canChat: false };
        case "blocked":
            return { label: "Blocked", canChat: false };
    }
}
