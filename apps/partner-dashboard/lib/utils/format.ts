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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatDate(value: any): string {
    const d = toDate(value);
    if (!d) return '—';
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

/** 15 Jan */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function formatDateShort(value: any): string {
    const d = toDate(value);
    if (!d) return '—';
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
}

/** 15 Jan 2026, 8:30 PM */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    if (value >= 1_00_000)    return `${(value / 1_00_000).toFixed(1)}L`;
    if (value >= 1_000)       return `${(value / 1_000).toFixed(1)}K`;
    return new Intl.NumberFormat('en-IN').format(value);
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
