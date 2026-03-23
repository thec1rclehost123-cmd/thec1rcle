import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/server/withAuth'
import { ok, fail } from '@/lib/server/apiResponse'
import { getAdminDb } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/venue/alerts/[id]/dismiss
 *
 * Marks an alert as dismissed in Firestore.
 * Verifies the alert belongs to the authenticated user's venue before writing.
 */
export const PATCH = withAuth(async (req: NextRequest, auth, ctx) => {
    const alertId = ctx?.params?.id || ""
    if (!alertId) return fail('Alert ID is required', 400)

    try {
        const db = getAdminDb()
        const alertRef = db.collection('venue_alerts').doc(alertId)
        const snap = await alertRef.get()

        if (!snap.exists) return fail('Alert not found', 404)

        const alertData = snap.data()!
        const venueId = alertData.venueId as string | undefined
        if (venueId && (auth as any).partnerId && (auth as any).partnerId !== venueId) {
            return fail('Forbidden', 403)
        }

        await alertRef.update({ dismissed: true, dismissedAt: new Date().toISOString() })

        return ok(null, 'Alert dismissed')
    } catch (err: any) {
        console.error('[PATCH /api/venue/alerts/[id]/dismiss]', err)
        return fail('Failed to dismiss alert')
    }
})
