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

/** "Sat, Mar 15" or "TBD" */
export function formatEventDate(value: unknown): string {
  const d = safeDate(value);
  if (!d) return 'TBD';
  return d.toLocaleDateString('en-IN', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/** "8:00 PM" or "TBD" */
export function formatEventTime(value: unknown): string {
  const d = safeDate(value);
  if (!d) return 'TBD';
  return d.toLocaleTimeString('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
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
