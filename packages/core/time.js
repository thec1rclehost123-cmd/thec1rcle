/**
 * THE C1RCLE - Time & Date Utilities
 * Source of truth for IST (Indian Standard Time) handling across the platform.
 */

export const IST_TIMEZONE = 'Asia/Kolkata';
export const IN_LOCALE = 'en-IN';

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
  if (!dateValue) return '';
  const date = parseAsIST(dateValue);
  if (isNaN(date.getTime())) return String(dateValue);

  return date.toLocaleString(IN_LOCALE, {
    timeZone: IST_TIMEZONE,
    ...options,
  });
}

/**
 * Returns just the date part in IST (e.g., 05/01/2026)
 */
export function formatDateIST(dateValue, options = {}) {
  if (!dateValue) return '';
  const date = parseAsIST(dateValue);
  return date.toLocaleDateString(IN_LOCALE, {
    timeZone: IST_TIMEZONE,
    ...options,
  });
}

/**
 * Returns just the time part in IST (e.g., 9:00 PM)
 */
export function formatTimeIST(dateValue, options = {}) {
  if (!dateValue) return '';
  const date = parseAsIST(dateValue);
  return date.toLocaleTimeString(IN_LOCALE, {
    timeZone: IST_TIMEZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    ...options,
  });
}

/**
 * Formats an event date (e.g., "Fri, Jan 5") in IST.
 */
export function formatEventDate(dateValue, fallback = 'Date TBA') {
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
    day: 'numeric',
  });
}

/**
 * Formats an event time (e.g., "9:00 PM") in IST.
 */
export function formatEventTime(timeValue, startDate, fallback = 'Time TBA') {
  if (typeof timeValue === 'string' && /^\d{1,2}:\d{2}(?::\d{2})?$/.test(timeValue)) {
    try {
      const parts = timeValue.split(':');
      const hours = Number(parts[0]);
      const minutes = Number(parts[1]);
      // Use a fixed date to avoid DST issues, though India doesn't have DST
      const date = new Date(2024, 0, 1, hours, minutes);
      return date.toLocaleTimeString(IN_LOCALE, {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      /* fallback */
    }
  }

  // 2. If it already looks like a formatted time string (e.g. "9:00 PM"), return
  if (
    typeof timeValue === 'string' &&
    timeValue.includes(':') &&
    !timeValue.includes('T') &&
    (timeValue.includes('AM') || timeValue.includes('PM'))
  ) {
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
        hour12: true,
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

/**
 * Resolves precise, timezone-aware startAt and endAt timestamps in IST (Asia/Kolkata)
 * for an event. Accounts for event date, start time, end date, and end time.
 * Includes overnight support when end time is numerically less than start time.
 */
export function getEventTimestamps(event = {}) {
  const dateStr = event.startAt || event.startDate || event.startDateTime;
  const timeStr = event.startTime || event.time;

  const endDateStr = event.endAt || event.endDate || event.endDateTime || dateStr;
  const endTimeStr = event.endTime;

  let startTs = 0;
  let endTs = 0;

  // Helper to convert Firestore timestamp/Date/string to ISO string
  const toIsoLocal = (value) => {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (typeof value?.toDate === 'function') return value.toDate().toISOString();
    if (value instanceof Date) return value.toISOString();
    return null;
  };

  const isDateOnly = (val) => typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val.trim());

  const isoDate = toIsoLocal(dateStr);
  const isoEndDate = toIsoLocal(endDateStr);

  // Parse startAt
  if (isoDate) {
    const trimmed = isoDate.trim();
    if (isDateOnly(trimmed)) {
      let timePart = '00:00:00';
      if (timeStr && typeof timeStr === 'string') {
        const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})/);
        if (match) {
          timePart = `${match[1].padStart(2, '0')}:${match[2]}:00`;
        }
      }
      startTs = new Date(`${trimmed}T${timePart}+05:30`).getTime();
    } else {
      startTs = new Date(trimmed).getTime();
    }
  }

  if (Number.isNaN(startTs)) startTs = 0;

  // Parse endAt
  if (isoEndDate) {
    const trimmed = isoEndDate.trim();
    if (isDateOnly(trimmed)) {
      let timePart = '23:59:59.999';
      if (endTimeStr && typeof endTimeStr === 'string') {
        const match = endTimeStr.trim().match(/^(\d{1,2}):(\d{2})/);
        if (match) {
          timePart = `${match[1].padStart(2, '0')}:${match[2]}:00`;
        }
      }
      endTs = new Date(`${trimmed}T${timePart}+05:30`).getTime();
    } else {
      endTs = new Date(trimmed).getTime();
    }
  }

  if (Number.isNaN(endTs)) endTs = 0;

  // Apply Overnight Support
  // If start and end date strings are date-only and match,
  // and the end time is numerically less than the start time, shift endTs by 1 day (24 hours).
  if (
    typeof isoDate === 'string' &&
    typeof isoEndDate === 'string' &&
    isDateOnly(isoDate) &&
    isDateOnly(isoEndDate) &&
    isoDate.trim() === isoEndDate.trim() &&
    timeStr &&
    endTimeStr
  ) {
    const startMatch = String(timeStr)
      .trim()
      .match(/^(\d{1,2}):(\d{2})/);
    const endMatch = String(endTimeStr)
      .trim()
      .match(/^(\d{1,2}):(\d{2})/);
    if (startMatch && endMatch) {
      const startMins = parseInt(startMatch[1], 10) * 60 + parseInt(startMatch[2], 10);
      const endMins = parseInt(endMatch[1], 10) * 60 + parseInt(endMatch[2], 10);
      if (endMins < startMins) {
        endTs += 24 * 60 * 60 * 1000; // Add 1 day in milliseconds
      }
    }
  }

  return { startAt: startTs, endAt: endTs };
}
