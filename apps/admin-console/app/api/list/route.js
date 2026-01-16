import { NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebase/admin";
import { withAdminAuth } from "@/lib/server/adminMiddleware";

export const dynamic = 'force-dynamic';

const ALLOWED_COLLECTIONS = [
    'users',
    'venues',
    'hosts',
    'promoters',
    'admins',
    'events',
    'orders',
    'onboarding_requests',
    'host_applications',
    'admin_audit_logs',
    'proposed_actions',
    'support_tickets',
    'platform_config',
    'safety_reports',
    'failed_webhooks',
    'retry_jobs'
];

async function handler(req) {
    const { searchParams } = new URL(req.url);
    const collection = searchParams.get('collection');
    const status = searchParams.get('status');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 200);

    const baseCollection = collection ? collection.split('/')[0] : null;

    if (!collection || !ALLOWED_COLLECTIONS.includes(baseCollection)) {
        return NextResponse.json({ error: "Invalid resource request" }, { status: 400 });
    }

    // --- 🔐 RBAC ENFORCEMENT ---
    const adminRole = req.user.admin_role;
    const ALLOWED_MAP = {
        'super': ['*'],
        'finance': ['users', 'orders', 'payments', 'onboarding_requests', 'host_applications', 'admin_audit_logs', 'retry_jobs'],
        'ops': ['users', 'venues', 'hosts', 'promoters', 'events', 'proposed_actions', 'admin_audit_logs', 'safety_reports', 'retry_jobs', 'failed_webhooks', 'onboarding_requests', 'host_applications', 'support_tickets'],
        'support': ['users', 'venues', 'hosts', 'promoters', 'events', 'safety_reports', 'support_tickets', 'onboarding_requests'],
        'content': ['venues', 'events'],
        'readonly': ['users', 'venues', 'hosts', 'promoters', 'events']
    };

    const allowed = ALLOWED_MAP[adminRole] || [];
    if (!allowed.includes('*') && !allowed.includes(baseCollection)) {
        return NextResponse.json({ error: "Access Denied: Insufficient authority for this dataset." }, { status: 403 });
    }

    try {
        const db = getAdminDb();
        let query = db.collection(collection);

        // Filters
        if (status) {
            query = query.where('status', '==', status);
        }

        // Enforce consistent ordering
        if (collection === 'admin_audit_logs') {
            query = query.orderBy('timestamp', 'desc');
        } else if (collection === 'events') {
            query = query.orderBy('startTime', 'desc');
        } else if (collection === 'onboarding_requests') {
            query = query.orderBy('submittedAt', 'desc');
        } else if (['proposed_actions', 'users', 'admins', 'orders', 'venues', 'hosts', 'promoters'].includes(collection)) {
            query = query.orderBy('createdAt', 'desc');
        } else if (collection === 'retry_jobs') {
            query = query.orderBy('createdAt', 'desc');
        }

        const snapshot = await query.limit(limit).get();
        let results = snapshot.docs.map(doc => {
            const docData = doc.data();
            const base = {
                id: doc.id,
                ...docData,
                // Unified timestamp normalization
                timestamp: docData.timestamp?.toDate?.()?.toISOString() || docData.ts?.toDate?.()?.toISOString(),
                createdAt: docData.createdAt?.toDate?.()?.toISOString() || docData.createdAt,
                updatedAt: docData.updatedAt?.toDate?.()?.toISOString() || docData.updatedAt,
                submittedAt: docData.submittedAt?.toDate?.()?.toISOString(),
                ts: docData.ts?.toDate?.()?.toISOString() || docData.ts
            };
            return base;
        });

        // Specialized Mapping for Events
        if (collection === 'events') {
            const { mapEventForClient } = await import("@c1rcle/core/events");
            results = results.map(r => mapEventForClient(r, r.id));
        }

        // Maintain compatibility with frontend expectations
        return NextResponse.json({ data: results, results });
    } catch (error) {
        console.error(`[SECURITY] List API Error [${collection}]:`, error.message);
        return NextResponse.json({ error: "Generic data error" }, { status: 500 });
    }
}

export const GET = withAdminAuth(handler);
