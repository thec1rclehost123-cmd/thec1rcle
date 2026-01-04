/**
 * THE C1RCLE - Admin Refunds API
 * List and filter refund requests
 */

import { NextResponse } from "next/server";
import { getAdminDb, isFirebaseConfigured } from "../../../../lib/firebase/admin";
import { verifyAuth as verifyAdminAuth } from "../../../../lib/server/auth";

const REFUND_REQUESTS_COLLECTION = "refund_requests";

export async function GET(request) {
    try {
        // Verify admin authentication
        const admin = await verifyAdminAuth(request);
        if (!admin) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status') || 'pending';
        const limit = parseInt(searchParams.get('limit') || '50');

        if (!isFirebaseConfigured()) {
            // Return mock data for development
            return NextResponse.json({
                refunds: [],
                total: 0
            });
        }

        const db = getAdminDb();
        let query = db.collection(REFUND_REQUESTS_COLLECTION)
            .orderBy('createdAt', 'desc')
            .limit(limit);

        if (status !== 'all') {
            query = query.where('status', '==', status);
        }

        const snapshot = await query.get();
        const refunds = [];

        // Enrich with event/order data if needed
        for (const doc of snapshot.docs) {
            const data = doc.data();
            refunds.push({
                id: doc.id,
                ...data
            });
        }

        return NextResponse.json({
            refunds,
            total: refunds.length
        });

    } catch (error) {
        console.error("GET /api/admin/refunds error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch refunds" },
            { status: 500 }
        );
    }
}
