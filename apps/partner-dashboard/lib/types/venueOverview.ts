import type { FinanceOverviewMetrics } from '@/lib/finance/definitions'

export type DateRange = '1d' | '7d' | '30d' | '90d'

// ── KPI shape returned by the gateway analytics/overview endpoint ─────────────

export interface VenueSummaryKPIs {
    weekendRevenue: number
    activeEventsCount: number
    avgEntryVelocity: string | null
    totalGuestProfiles: number
    newGuestsThisWeek: number
    revenueTrend: string | null
    revenueTrendDirection: 'up' | 'down' | 'neutral'
    dataReady: boolean
}

// ── Combined summary returned by /api/venue/overview/summary ─────────────────
// Extends the flat KPI shape (backward compat) and adds finance + _meta.

export interface VenueOverviewSummary extends VenueSummaryKPIs {
    finance: FinanceOverviewMetrics | null
    _meta: {
        fetchedAt: string
        range: DateRange
        partial: boolean
        failures: string[]
    }
}

// ── Event ────────────────────────────────────────────────────────────────────

export interface UpcomingEvent {
    id: string
    title: string
    startDate: string
    date?: string
    lifecycle: string
    status?: string
    capacity?: number
    ticketsSold?: number
}

// ── Tonight ops data returned by /api/venue/overview/tonight ─────────────────

export interface TonightOpsData {
    /** event id may come as `id` or `eventId` depending on source */
    id?: string
    eventId?: string
    eventName?: string
    expected: number
    confirmed: number
    checkedIn: number
    revenue: number
    ticketsSold: number
    promotersCount: number
    guestlistCount: number
    entryVelocity?: number
    entryRate?: string
    entryHistory?: number[]
    _meta?: {
        source: string
        fetchedAt: string
    }
}

// ── Firestore occupancy snapshot (from onSnapshot) ───────────────────────────

export interface OccupancySnapshot {
    checkedIn: number
    capacity: number
    occupancyPct: number
    lastScanAt: string | null
}

// ── Alert ────────────────────────────────────────────────────────────────────

export interface VenueAlert {
    id: string
    type: string
    title: string
    description: string
    severity: 'info' | 'warning' | 'critical'
    isRead: boolean
    createdAt: string
    timestamp?: string
    href?: string
    venueId?: string
    dismissed?: boolean
}

// ── Live event status ─────────────────────────────────────────────────────────

export type LiveEventStatus = 'no_event' | 'connecting' | 'live' | 'degraded' | 'offline'
