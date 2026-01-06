/**
 * THE C1RCLE - Time & Date Utilities
 * Source of truth for IST (Indian Standard Time) handling across the platform.
 */

export const IST_TIMEZONE = "Asia/Kolkata";
export const IN_LOCALE = "en-IN";

/**
 * Returns a Date object parsed correctly as IST.
 * Standardizes parsing of Firestore Timestamps, ISO strings, and YYYY-MM-DD.
 */
export function parseAsIST(dateValue) {
    if (!dateValue) return new Date();

    // Handle Firestore Timestamp
    if (dateValue && typeof dateValue.toDate === 'function') {
        return dateValue.toDate();
    }

    // Handle milliseconds or Date object
    if (typeof dateValue === 'number' || dateValue instanceof Date) {
        return new Date(dateValue);
    }

    if (typeof dateValue === 'string') {
        // Handle YYYY-MM-DD format as local date shifted to IST morning
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
            // Append IST offset to ensure it's parsed as India time
            return new Date(`${dateValue}T00:00:00+05:30`);
        }
        return new Date(dateValue);
    }

    return new Date(dateValue);
}

/**
 * Formats a date value to IST locale string.
 */
export function formatIST(dateValue, options = {}) {
    if (!dateValue) return "";
    const date = parseAsIST(dateValue);
    if (isNaN(date.getTime())) return String(dateValue);

    return date.toLocaleString(IN_LOCALE, {
        timeZone: IST_TIMEZONE,
        ...options
    });
}

/**
 * Returns just the date part in IST (e.g., 05/01/2026)
 */
export function formatDateIST(dateValue, options = {}) {
    if (!dateValue) return "";
    const date = parseAsIST(dateValue);
    return date.toLocaleDateString(IN_LOCALE, {
        timeZone: IST_TIMEZONE,
        ...options
    });
}

/**
 * Returns just the time part in IST (e.g., 9:00 PM)
 */
export function formatTimeIST(dateValue, options = {}) {
    if (!dateValue) return "";
    const date = parseAsIST(dateValue);
    return date.toLocaleTimeString(IN_LOCALE, {
        timeZone: IST_TIMEZONE,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        ...options
    });
}

/**
 * Formats an event date (e.g., "Fri, Jan 5") in IST.
 */
export function formatEventDate(dateValue, fallback = "Date TBA") {
    if (!dateValue) return fallback;

    // If it's already a nicely formatted string (like "Fri, Jan 16"), return as-is
    if (typeof dateValue === 'string' && !dateValue.includes('T') && !dateValue.includes('-')) {
        return dateValue;
    }

    const date = parseAsIST(dateValue);
    if (isNaN(date.getTime())) return fallback;

    return date.toLocaleDateString(IN_LOCALE, {
        timeZone: IST_TIMEZONE,
        weekday: 'short',
        month: 'short',
        day: 'numeric'
    });
}

/**
 * Formats an event time (e.g., "9:00 PM") in IST.
 */
export function formatEventTime(timeValue, startDate, fallback = "Time TBA") {
    // 1. If it's a simple HH:mm string (e.g. from a <input type="time">), format it
    if (typeof timeValue === 'string' && /^\d{1,2}:\d{2}$/.test(timeValue)) {
        try {
            const [hours, minutes] = timeValue.split(':').map(Number);
            // Use a fixed date to avoid DST issues, though India doesn't have DST
            const date = new Date(2024, 0, 1, hours, minutes);
            return date.toLocaleTimeString(IN_LOCALE, {
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
        } catch { /* fallback */ }
    }

    // 2. If it already looks like a formatted time string (e.g. "9:00 PM"), return
    if (typeof timeValue === 'string' && timeValue.includes(':') && !timeValue.includes('T') && (timeValue.includes('AM') || timeValue.includes('PM'))) {
        return timeValue;
    }

    // 3. Try to get time from ISO startDate, ensuring IST conversion
    if (startDate) {
        const date = parseAsIST(startDate);
        if (!isNaN(date.getTime())) {
            return date.toLocaleTimeString(IN_LOCALE, {
                timeZone: IST_TIMEZONE,
                hour: 'numeric',
                minute: '2-digit',
                hour12: true
            });
        }
    }

    return typeof timeValue === 'string' ? timeValue : fallback;
}

/**
 * Returns a YYYY-MM-DD string in IST timezone.
 */
export function toISODateIST(dateValue) {
    const date = parseAsIST(dateValue);
    const year = date.toLocaleString(IN_LOCALE, { timeZone: IST_TIMEZONE, year: 'numeric' });
    const month = date.toLocaleString(IN_LOCALE, { timeZone: IST_TIMEZONE, month: '2-digit' });
    const day = date.toLocaleString(IN_LOCALE, { timeZone: IST_TIMEZONE, day: '2-digit' });
    return `${year}-${month}-${day}`;
}
