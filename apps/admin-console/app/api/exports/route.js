import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/server/adminMiddleware";
import { getAdminDb } from "@/lib/firebase/admin";
import { adminStore } from "@/lib/server/adminStore";

const ALLOWED_EXPORTS = ['users', 'venues', 'hosts', 'events', 'orders', 'admin_logs'];

async function handler(req) {
    try {
        const { searchParams } = new URL(req.url);
        const collection = searchParams.get('collection');
        const limitStr = searchParams.get('limit') || '2000';
        const limit = Math.min(parseInt(limitStr), 2000);
        const adminId = req.user.uid;
        const adminRole = req.user.admin_role;

        const context = {
            ipAddress: req.user.ipAddress,
            userAgent: req.user.userAgent,
            requestId: req.user.requestId
        };

        if (!collection || !ALLOWED_EXPORTS.includes(collection)) {
            return NextResponse.json({ error: "Invalid collection for export" }, { status: 400 });
        }

        // --- 🔐 RBAC ENFORCEMENT ---
        // Matrix:
        // Super: All
        // Finance: users, orders, payments, host_applications
        // Ops: users, venues, events, hosts, safety_reports
        // Others: Deny
        const ALLOWED_MAP = {
            'super': ['*'],
            'finance': ['users', 'orders', 'payments', 'host_applications', 'admin_audit_logs'],
            'ops': ['users', 'venues', 'events', 'hosts', 'host_applications', 'safety_reports', 'admin_audit_logs']
        };

        const allowed = ALLOWED_MAP[adminRole] || [];
        if (!allowed.includes('*') && !allowed.includes(collection)) {
            return NextResponse.json({ error: "Access Denied: Insufficient authority for this dataset." }, { status: 403 });
        }

        const db = getAdminDb();
        let query = db.collection(collection).limit(limit);

        // Enforce deterministic ordering for exports
        if (collection === 'users' || collection === 'orders' || collection === 'admin_audit_logs') {
            query = query.orderBy('createdAt', 'desc'); // or ts/timestamp depending on collection, but createdAt is safe default or fields need alignment
        }

        const snapshot = await query.get();
        const rawData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        if (rawData.length === 0) {
            return NextResponse.json({ error: "No data available for export" }, { status: 404 });
        }

        // --- 🧹 PII SANITIZATION ---
        // Enhanced redaction list
        const BLOCKED_FIELDS = [
            'password', 'hash', 'salt', 'token', 'refreshToken', 'accessToken',
            'secret', 'key', 'otp', 'emailVerified', 'phoneNumber',
            'stripeId', 'razorpayKey', 'bankDetails', 'authClaims', 'sessionCookie'
        ];

        const data = rawData.map(item => {
            const clean = { ...item };

            // Explicit PII removal for non-super/finance
            if (adminRole !== 'super' && adminRole !== 'finance') {
                if (clean.email) clean.email = '[REDACTED]';
                if (clean.phone) clean.phone = '[REDACTED]';
            }

            BLOCKED_FIELDS.forEach(f => {
                if (f in clean) clean[f] = '[REDACTED]';
            });

            // Nested object redaction (shallow)
            Object.keys(clean).forEach(k => {
                if (typeof clean[k] === 'object' && clean[k] !== null) {
                    // Check common nested PII
                    if (clean[k].token) clean[k].token = '[REDACTED]';
                    if (clean[k].secret) clean[k].secret = '[REDACTED]';
                }
            });

            return clean;
        });

        const headers = Object.keys(data[0]).filter(k => typeof data[0][k] !== 'object');
        const csvRows = [
            headers.join(','),
            ...data.map(row => headers.map(header => JSON.stringify(row[header] || "")).join(','))
        ];
        const csvString = csvRows.join('\n');

        // Task 3: Unified Auditing using logAdminAction
        await adminStore.logAdminAction({
            adminId,
            adminRole,
            action: 'DATA_EXPORT',
            targetId: `${collection}:${limit}`,
            targetType: 'exports',
            reason: `Manual CSV export generated for ${collection}`,
            after: { rowCount: data.length },
            context
        });

        return new NextResponse(csvString, {
            headers: {
                'Content-Type': 'text/csv',
                'Content-Disposition': `attachment; filename="${collection}_export_${Date.now()}.csv"`
            }
        });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export const GET = withAdminAuth(handler);
