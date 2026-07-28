/**
 * Safe date utilities for the mobile app.
 * Handles Firestore Timestamps, ISO strings, Date objects, and nullish values
 * without ever throwing.
 */

/** Parse any date-like value into a Date, returning null on failure. */
export function safeDate(value: unknown): Date | null {
  if (!value) return null;

  // Firestore Timestamp (has toDate method)
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    try {
      return (value as { toDate: () => Date }).toDate();
    } catch {
      return null;
    }
  }

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

export const DEFAULT_EVENT_TIME_ZONE = 'Asia/Kolkata';

/** Resolve the single canonical start instant accepted across event contracts. */
export function canonicalEventStart(event: Record<string, unknown> | null | undefined): string {
  if (!event) return '';
  for (const key of ['startAt', 'startDate', 'startDateTime', 'startsAt', 'date'] as const) {
    const date = safeDate(event[key]);
    if (date) return date.toISOString();
  }
  return '';
}

export function resolveEventTimeZone(value?: string): string {
  const candidate =
    typeof value === 'string' && value.trim() ? value.trim() : DEFAULT_EVENT_TIME_ZONE;
  try {
    new Intl.DateTimeFormat('en-IN', { timeZone: candidate }).format(0);
    return candidate;
  } catch {
    return DEFAULT_EVENT_TIME_ZONE;
  }
}

/** "Sat, Mar 15" or "TBD" */
export function formatEventDate(value: unknown, timeZone?: string): string {
  const d = safeDate(value);
  if (!d) return 'TBD';
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: resolveEventTimeZone(timeZone),
  });
}

/** "Saturday, 15 March" or "TBD" */
export function formatEventDateLong(value: unknown, timeZone?: string): string {
  const d = safeDate(value);
  if (!d) return 'TBD';
  return d.toLocaleDateString('en-IN', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: resolveEventTimeZone(timeZone),
  });
}

/** "8:00 PM" or "TBD" */
export function formatEventTime(value: unknown, timeZone?: string): string {
  const d = safeDate(value);
  if (!d) return 'TBD';
  return d.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: resolveEventTimeZone(timeZone),
  });
}

/** "Aug 29th • 9 PM" or an empty label for ticket cards. */
export function formatTicketCardDate(value: unknown, timeZone?: string): string {
  const date = safeDate(value);
  if (!date) return '';
  const resolvedTimeZone = resolveEventTimeZone(timeZone);
  const month = date.toLocaleDateString('en-US', {
    month: 'short',
    timeZone: resolvedTimeZone,
  });
  const day = Number(
    date.toLocaleDateString('en-US', {
      day: 'numeric',
      timeZone: resolvedTimeZone,
    }),
  );
  const suffix =
    day > 3 && day < 21
      ? 'th'
      : day % 10 === 1
        ? 'st'
        : day % 10 === 2
          ? 'nd'
          : day % 10 === 3
            ? 'rd'
            : 'th';
  const time = formatEventTime(date, resolvedTimeZone).replace(':00', '').toUpperCase();
  return `${month} ${day}${suffix} • ${time}`;
}

/** "2 min ago", "3h ago", "5d ago" */
export function formatRelativeTime(value: unknown): string {
  const d = safeDate(value);
  if (!d) return '';

  const diff = Date.now() - d.getTime();
  const minutes = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatEventDate(d);
}
