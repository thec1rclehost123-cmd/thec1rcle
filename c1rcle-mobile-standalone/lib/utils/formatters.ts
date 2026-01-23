// Date and data formatting utilities for THE C1RCLE mobile app
// Handles Firestore Timestamps, ISO strings, and invalid dates gracefully

import { Timestamp } from "firebase/firestore";

/**
 * Safely parse any date value into a Date object
 * Handles: Firestore Timestamp, ISO string, Date object, undefined, null
 */
export function safeParseDate(dateValue: any): Date | null {
    if (!dateValue) return null;

    // Handle Firestore Timestamp
    if (dateValue instanceof Timestamp) {
        return dateValue.toDate();
    }

    // Handle Firestore Timestamp-like object (from JSON)
    if (dateValue?.seconds !== undefined && dateValue?.nanoseconds !== undefined) {
        return new Timestamp(dateValue.seconds, dateValue.nanoseconds).toDate();
    }

    // Handle Date object
    if (dateValue instanceof Date) {
        return isNaN(dateValue.getTime()) ? null : dateValue;
    }

    // Handle ISO string or any string
    if (typeof dateValue === "string") {
        const parsed = new Date(dateValue);
        return isNaN(parsed.getTime()) ? null : parsed;
    }

    // Handle number (Unix timestamp in ms)
    if (typeof dateValue === "number") {
        const parsed = new Date(dateValue);
        return isNaN(parsed.getTime()) ? null : parsed;
    }

    return null;
}

/**
 * Format event date for display
 * Returns "Date TBA" for invalid/missing dates
 */
export function formatEventDate(dateValue: any, format: "short" | "long" | "full" = "short"): string {
    const date = safeParseDate(dateValue);
    if (!date) return "Date TBA";

    try {
        switch (format) {
            case "short":
                return date.toLocaleDateString("en-IN", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                });
            case "long":
                return date.toLocaleDateString("en-IN", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                });
            case "full":
                return date.toLocaleDateString("en-IN", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                });
            default:
                return date.toLocaleDateString("en-IN", {
                    month: "short",
                    day: "numeric",
                });
        }
    } catch {
        return "Date TBA";
    }
}

/**
 * Format event time for display
 */
export function formatEventTime(dateValue: any): string {
    const date = safeParseDate(dateValue);
    if (!date) return "Time TBA";

    try {
        return date.toLocaleTimeString("en-IN", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
        });
    } catch {
        return "Time TBA";
    }
}

/**
 * Get day and month separately (for date badges)
 */
export function getDateParts(dateValue: any): { day: string; month: string; weekday: string } {
    const date = safeParseDate(dateValue);
    if (!date) {
        return { day: "TBA", month: "", weekday: "" };
    }

    try {
        return {
            day: date.getDate().toString(),
            month: date.toLocaleDateString("en-IN", { month: "short" }).toUpperCase(),
            weekday: date.toLocaleDateString("en-IN", { weekday: "short" }),
        };
    } catch {
        return { day: "TBA", month: "", weekday: "" };
    }
}

/**
 * Check if event is happening today
 */
export function isToday(dateValue: any): boolean {
    const date = safeParseDate(dateValue);
    if (!date) return false;

    const today = new Date();
    return (
        date.getDate() === today.getDate() &&
        date.getMonth() === today.getMonth() &&
        date.getFullYear() === today.getFullYear()
    );
}

/**
 * Check if event is happening this week
 */
export function isThisWeek(dateValue: any): boolean {
    const date = safeParseDate(dateValue);
    if (!date) return false;

    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return date >= now && date <= weekFromNow;
}

/**
 * Check if event is in the past
 */
export function isPast(dateValue: any): boolean {
    const date = safeParseDate(dateValue);
    if (!date) return false;

    return date < new Date();
}

/**
 * Get relative time string (e.g., "in 2 hours", "tomorrow")
 */
export function getRelativeTime(dateValue: any): string {
    const date = safeParseDate(dateValue);
    if (!date) return "";

    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMs < 0) {
        return "Past";
    } else if (diffHours < 1) {
        return "Starting soon";
    } else if (diffHours < 24) {
        return `in ${diffHours} hour${diffHours > 1 ? "s" : ""}`;
    } else if (diffDays === 1) {
        return "Tomorrow";
    } else if (diffDays < 7) {
        return `in ${diffDays} days`;
    } else {
        return "";
    }
}

/**
 * Normalize category to lowercase for consistent filtering
 */
export function normalizeCategory(category: any): string | null {
    if (!category || typeof category !== "string") return null;
    return category.toLowerCase().trim();
}

/**
 * Get display name for category
 */
export function getCategoryDisplayName(category: string | null | undefined): string {
    if (!category) return "Event";

    const categoryMap: Record<string, string> = {
        club: "Club Night",
        clubbing: "Club Night",
        concert: "Concert",
        festival: "Festival",
        party: "Party",
        brunch: "Brunch",
        comedy: "Comedy",
        social: "Social",
        "ladies night": "Ladies Night",
        "day party": "Day Party",
        afterhours: "After Hours",
        "after hours": "After Hours",
    };

    const normalized = category.toLowerCase().trim();
    return categoryMap[normalized] || category.charAt(0).toUpperCase() + category.slice(1);
}

/**
 * Get venue display string with fallbacks
 */
export function getVenueDisplay(event: {
    venue?: string;
    location?: string;
    city?: string;
}): string {
    if (event.venue && event.venue.trim()) return event.venue.trim();
    if (event.location && event.location.trim()) return event.location.trim();
    if (event.city && event.city.trim()) return event.city.trim();
    return "Venue TBA";
}

/**
 * Format price for display
 */
export function formatPrice(price: number | undefined | null): string {
    if (price === undefined || price === null) return "Price TBA";
    if (price === 0) return "Free";
    return `₹${price.toLocaleString("en-IN")}`;
}

/**
 * Get lowest ticket price from event
 */
export function getLowestPrice(tickets: Array<{ price: number }> | undefined): number | null {
    if (!tickets || tickets.length === 0) return null;
    return Math.min(...tickets.map((t) => t.price));
}
