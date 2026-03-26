import { NextResponse } from "next/server";
import { adminStore } from "@/lib/server/adminStore";
import { withAdminAuth } from "@/lib/server/adminMiddleware";

export const dynamic = 'force-dynamic';

const ALLOWED_COLLECTIONS = [
    'users', 'venues', 'hosts', 'promoters', 'admins', 'events', 'orders',
    'onboarding_requests', 'host_applications', 'admin_audit_logs', 'proposed_actions',
    'support_tickets', 'platform_config', 'platform_settings', 'app_config', 'safety_reports', 'failed_webhooks', 'retry_jobs'
];

const ALLOWED_SORT_FIELDS = ['createdAt', 'updatedAt', 'status', 'amount', 'name', 'email'];

async function handler(req) {
    const { searchParams } = new URL(req.url);
    const collection = searchParams.get('collection');
    const status = searchParams.get('status');
    const sortBy = searchParams.get('sortBy') || 'createdAt';
    const cursor = searchParams.get('cursor') || null;
    const rawLimit = parseInt(searchParams.get('limit') || '50', 10);

    if (isNaN(rawLimit) || rawLimit <= 0) {
        return NextResponse.json({ error: "Invalid limit" }, { status: 400 });
    }
    const limit = Math.min(rawLimit, 200);

    if (!ALLOWED_SORT_FIELDS.includes(sortBy)) {
        return NextResponse.json({ error: "Invalid sort field" }, { status: 400 });
    }

    const baseCollection = collection ? collection.split('/')[0] : null;

    if (!collection || !ALLOWED_COLLECTIONS.includes(baseCollection)) {
        return NextResponse.json({ error: "Invalid resource request" }, { status: 400 });
    }

    // --- 🔐 RBAC ENFORCEMENT ---
    const adminRole = req.user.admin_role;
    const ALLOWED_MAP = {
        'super': ['*'],
        'admin': ['*'],
        'finance': ['users', 'orders', 'payments', 'onboarding_requests', 'host_applications', 'admin_audit_logs', 'retry_jobs'],
        'ops': ['users', 'venues', 'hosts', 'promoters', 'events', 'proposed_actions', 'admin_audit_logs', 'safety_reports', 'retry_jobs', 'failed_webhooks', 'onboarding_requests', 'host_applications', 'support_tickets', 'platform_settings', 'app_config'],
        'support': ['users', 'venues', 'hosts', 'promoters', 'events', 'safety_reports', 'support_tickets', 'onboarding_requests'],
        'content': ['venues', 'events'],
        'readonly': ['users', 'venues', 'hosts', 'promoters', 'events']
    };

    const allowed = ALLOWED_MAP[adminRole] || [];
    if (!allowed.includes('*') && !allowed.includes(baseCollection)) {
        return NextResponse.json({ error: "Access Denied: Insufficient authority for this dataset." }, { status: 403 });
    }

    try {
        let results = await adminStore.listCollection(collection, { status, limit, adminRole, sortBy, cursor });

        // Specialized Mapping for Events
        if (collection === 'events') {
            const { mapEventForClient } = await import("@c1rcle/core/events");
            results = results.map(r => mapEventForClient(r, r.id));
        }

        return NextResponse.json({ data: results, results });
    } catch (error) {
        console.error(`[SECURITY] List API Error [${collection}]:`, error.message);
        return NextResponse.json({ error: "Generic data error" }, { status: error.statusCode || 500 });
    }
}

export const GET = withAdminAuth(handler);
