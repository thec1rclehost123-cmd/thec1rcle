/**
 * Canonical display formatters for the Partner Dashboard.
 *
 * Single source of truth for date, time, currency, and number display.
 * All PageClient components should import from here instead of formatting inline.
 *
 * Currency formatters are re-exported from lib/finance/definitions.ts so that
 * existing imports from there continue to work unchanged.
 */

export { formatINR, formatINRCompact } from '@/lib/finance/definitions';

/** Converts paise (smallest INR unit) to rupees and formats as ₹1,23,456 */
export function formatINRFromPaise(paise: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(paise / 100);
}

// ── Date / Time ──────────────────────────────────────────────────────────────

function toDate(value: any): Date | null {
  if (!value) return null;
  // Firestore Timestamp ({ toDate(): Date })
  if (typeof value?.toDate === 'function') {
    const d: Date = value.toDate();
    return isNaN(d.getTime()) ? null : d;
  }
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value;
  const d = new Date(value as string);
  return isNaN(d.getTime()) ? null : d;
}

/** 15 Jan 2026 — also accepts Firestore Timestamps */

export function formatDate(value: any): string {
  const d = toDate(value);
  if (!d) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** Mar 2026 */

export function formatMonthYear(value: any): string {
  const d = toDate(value);
  if (!d) return '—';
  return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
}

/** "2 days ago", "3h ago", "just now" — falls back to formatDate beyond 30 days */

export function formatRelativeDate(value: any): string {
  const d = toDate(value);
  if (!d) return '—';
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return formatDate(value);
}

/** 15 Jan */

export function formatDateShort(value: any): string {
  const d = toDate(value);
  if (!d) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

/** 15 Jan 2026, 8:30 PM */

export function formatDatetime(value: any): string {
  const d = toDate(value);
  if (!d) return '—';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** 8:30 PM */

export function formatTime(value: any): string {
  const d = toDate(value);
  if (!d) return '—';
  return d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// ── Numbers ──────────────────────────────────────────────────────────────────

/** 1,23,456 (Indian locale, full) */
export function formatNumber(value: number | undefined | null): string {
  if (value == null || isNaN(value)) return '0';
  return new Intl.NumberFormat('en-IN').format(value);
}

/** 1.2K / 3.4L / 1.2Cr (compact Indian locale) */
export function formatNumberCompact(value: number | undefined | null): string {
  if (value == null || isNaN(value)) return '0';
  if (value >= 1_00_00_000) return `${(value / 1_00_00_000).toFixed(2)}Cr`;
  if (value >= 1_00_000) return `${(value / 1_00_000).toFixed(1)}L`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return new Intl.NumberFormat('en-IN').format(value);
}

// ── Period Labels ─────────────────────────────────────────────────────────────

/** Returns a human-readable label for a time period selector value. */
export function getPeriodLabel(period: string): string {
  switch (period) {
    case '7d':
      return 'Past 7 Days';
    case '30d':
      return 'Past 30 Days';
    case '90d':
      return 'Past 90 Days';
    case 'ytd':
      return 'Year to Date';
    default:
      return period;
  }
}

/** +12.3% or -4.5% */
export function formatPercentChange(value: number, decimals = 1): string {
  if (isNaN(value)) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(decimals)}%`;
}

/** 75% (no sign) */
export function formatPercent(value: number, decimals = 1): string {
  if (isNaN(value)) return '—';
  return `${value.toFixed(decimals)}%`;
}
