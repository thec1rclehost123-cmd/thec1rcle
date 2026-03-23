import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/server/withAuth'
import { fail } from '@/lib/server/apiResponse'
import { getAdminDb, isFirebaseConfigured } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'

/**
 * GET /api/venue/overview/alerts
 *
 * Returns unread/undismissed alerts from the last 24 hours for a venue.
 * Requires: Authorization header with Firebase ID token
 * Query params: venueId
 *
 * Returns empty alerts array on any failure so the dashboard never crashes.
 * Cache: 60s private + 2 min stale-while-revalidate
 */
export async function GET(req: NextRequest) {
    const auth = await requireAuth(req)
    if (auth instanceof NextResponse) return auth

    const { searchParams } = new URL(req.url)
    const venueId = searchParams.get('venueId')

    if (!venueId) return fail('venueId is required', 400)

    const cacheHeaders = {
        'Cache-Control': 'private, max-age=60, stale-while-revalidate=120',
    }

    // Return empty list in dev without Firebase rather than crashing
    if (!isFirebaseConfigured()) {
        return NextResponse.json({ alerts: [] }, { headers: cacheHeaders })
    }

    try {
        const db = getAdminDb()
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

        const snap = await db
            .collection('venue_alerts')
            .where('venueId', '==', venueId)
            .where('createdAt', '>=', oneDayAgo)
            .where('dismissed', '==', false)
            .orderBy('createdAt', 'desc')
            .limit(20)
            .get()

        const alerts = snap.docs.map(d => ({ id: d.id, ...d.data() }))

        return NextResponse.json({ alerts }, { headers: cacheHeaders })
    } catch (err: any) {
        // Log but never propagate — an alert failure must not break the dashboard
        console.error('[VenueAlerts] Firestore query failed:', err.message)
        return NextResponse.json({ alerts: [] }, { headers: cacheHeaders })
    }
}
