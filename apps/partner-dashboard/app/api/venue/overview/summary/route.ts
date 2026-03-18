import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/server/auth'
import { getApiClient } from '@/lib/server/apiClient'
import type { DateRange } from '@/lib/types/venueOverview'

export const dynamic = 'force-dynamic'

/**
 * GET /api/venue/overview/summary
 *
 * Returns KPI summary + finance snapshot in one request.
 * Both gateway calls run in parallel; partial failure is safe.
 *
 * Response shape is backward-compatible: all flat KPI fields are preserved
 * at the root level so existing KPIGridModule keeps working unchanged.
 * New keys: `finance` and `_meta`.
 *
 * Cache: 2 min private + 5 min stale-while-revalidate
 */
export async function GET(req: NextRequest) {
    const user = await verifyAuth(req)
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(req.url)
    const venueId = searchParams.get('venueId')
    const range = (searchParams.get('range') ?? '7d') as DateRange

    if (!venueId) {
        return NextResponse.json({ error: 'venueId is required' }, { status: 400 })
    }

    const token = req.headers.get('authorization')?.split('Bearer ')[1] ?? ''
    const client = getApiClient(token)

    // ── Parallel gateway calls — one failure must not block the other ─────────
    const [kpisResult, financeResult] = await Promise.allSettled([
        client.getAnalytics('venue', venueId, 'overview'),
        client.request(`/finance/summary?entityId=${venueId}&type=venue&period=${range}`),
    ])

    const kpis       = kpisResult.status === 'fulfilled'    ? kpisResult.value    : null
    const financeRaw = financeResult.status === 'fulfilled' ? financeResult.value : null

    const failures: string[] = [
        kpisResult.status    === 'rejected' ? 'kpis'    : null,
        financeResult.status === 'rejected' ? 'finance' : null,
    ].filter(Boolean) as string[]

    const finance = financeRaw ? normalizeFinance(financeRaw, range) : null

    return NextResponse.json(
        {
            // ── Flat KPI fields (backward compat with KPIGridModule) ──────────
            weekendRevenue:        kpis?.weekendRevenue        ?? 0,
            activeEventsCount:     kpis?.activeEventsCount     ?? 0,
            avgEntryVelocity:      kpis?.avgEntryVelocity      ?? null,
            totalGuestProfiles:    kpis?.totalGuestProfiles    ?? 0,
            newGuestsThisWeek:     kpis?.newGuestsThisWeek     ?? 0,
            revenueTrend:          kpis?.revenueTrend          ?? null,
            revenueTrendDirection: kpis?.revenueTrendDirection ?? 'neutral',
            dataReady:             !!kpis?.dataReady,
            // ── New keys ─────────────────────────────────────────────────────
            finance,
            _meta: {
                fetchedAt: new Date().toISOString(),
                range,
                partial:  failures.length > 0,
                failures,
            },
        },
        {
            headers: {
                'Cache-Control': 'private, max-age=120, stale-while-revalidate=300',
            },
        },
    )
}

// ── Normalizers ───────────────────────────────────────────────────────────────

function toNum(v: unknown): number {
    const n = Number(v)
    return isFinite(n) ? n : 0
}

function normalizeFinance(raw: Record<string, unknown>, range: DateRange) {
    return {
        grossRevenue:     toNum(raw.gross         ?? raw.grossRevenue),
        netRevenue:       toNum(raw.net           ?? raw.netRevenue),
        pendingPayouts:   toNum(raw.pendingPayouts ?? raw.pending),
        settledPayouts:   toNum(raw.settledPayouts ?? raw.settled),
        processingFees:   toNum(raw.processorFees  ?? raw.processingFees),
        platformFees:     toNum(raw.platformFees),
        refunds:          toNum(raw.refunds),
        chargebacks:      toNum(raw.chargebacks),
        availableBalance: toNum(raw.availableBalance ?? raw.balance),
        reserveBalance:   toNum(raw.reserveBalance),
        nextPayoutDate:   typeof raw.nextPayoutDate === 'string' ? raw.nextPayoutDate : undefined,
        payoutFailures:   toNum(raw.payoutFailures),
        partnerObligations: toNum(raw.partnerObligations ?? raw.commissions),
        period: range,
    }
}
