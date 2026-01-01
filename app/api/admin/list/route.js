import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { withAdminAuth } from "@/lib/server/adminMiddleware";

const ALLOWED_COLLECTIONS = [
    'users',
    'venues',
    'events',
    'orders',
    'host_applications',
    'admin_logs',
    'admin_proposed_actions'
];

async function handler(req) {
    const { searchParams } = new URL(req.url);
    const collection = searchParams.get('collection');
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

    // Task 2: Strict Directory Allowlist
    if (!collection || !ALLOWED_COLLECTIONS.includes(collection)) {
        return NextResponse.json({ error: "Invalid resource request" }, { status: 400 });
    }

    try {
        const db = getAdminDb();
        let query = db.collection(collection);

        // Filters
        if (status) {
            query = query.where('status', '==', status);
        }

        // Enforce consistent ordering for audit and ops visibility
        if (collection === 'admin_logs') {
            query = query.orderBy('timestamp', 'desc');
        } else if (collection === 'events') {
            query = query.orderBy('startTime', 'desc');
        } else if (collection === 'admin_proposed_actions') {
            query = query.orderBy('createdAt', 'desc');
        } else if (collection === 'users') {
            query = query.orderBy('createdAt', 'desc');
        } else if (collection === 'orders') {
            query = query.orderBy('createdAt', 'desc');
        }

        const snapshot = await query.limit(limit).get();
        const data = snapshot.docs.map(doc => {
            const docData = doc.data();
            return {
                id: doc.id,
                ...docData,
                // Safe timestamp conversion logic
                timestamp: docData.timestamp?.toDate?.()?.toISOString(),
                startTime: docData.startTime?.toDate?.()?.toISOString(),
                createdAt: docData.createdAt?.toDate?.()?.toISOString() || docData.createdAt,
                updatedAt: docData.updatedAt?.toDate?.()?.toISOString()
            };
        });

        return NextResponse.json({ data });
    } catch (error) {
        console.error(`[SECURITY] List API Error [${collection}]:`, error.message);
        return NextResponse.json({ error: "Generic data error" }, { status: 500 });
    }
}

export const GET = withAdminAuth(handler);
