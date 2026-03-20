import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/server/auth'
import { getAdminDb } from '@/lib/firebase/admin'

export const dynamic = 'force-dynamic'

/**
 * PATCH /api/venue/alerts/[id]/dismiss
 *
 * Marks an alert as dismissed in Firestore.
 * Verifies the alert belongs to the authenticated user's venue before writing.
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } },
) {
    const user = await verifyAuth(req)
    if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const alertId = params.id
    if (!alertId) {
        return NextResponse.json({ error: 'Alert ID is required' }, { status: 400 })
    }

    try {
        const db = getAdminDb()
        const alertRef = db.collection('venue_alerts').doc(alertId)
        const snap = await alertRef.get()

        if (!snap.exists) {
            return NextResponse.json({ error: 'Alert not found' }, { status: 404 })
        }

        // Verify the alert belongs to a venue the caller is authorized for
        const alertData = snap.data()!
        const venueId = alertData.venueId as string | undefined
        if (venueId && (user as any).partnerId && (user as any).partnerId !== venueId) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }

        await alertRef.update({ dismissed: true, dismissedAt: new Date().toISOString() })

        return NextResponse.json({ ok: true })
    } catch (err: any) {
        console.error('[PATCH /api/venue/alerts/[id]/dismiss]', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
