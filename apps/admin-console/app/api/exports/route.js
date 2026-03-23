import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/server/adminMiddleware";
import { adminStore } from "@/lib/server/adminStore";

export const dynamic = 'force-dynamic';

const ALLOWED_EXPORTS = ['users', 'venues', 'hosts', 'events', 'orders', 'admin_audit_logs'];

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
        const ALLOWED_MAP = {
            'super': ['*'],
            'finance': ['users', 'orders', 'payments', 'host_applications', 'admin_audit_logs'],
            'ops': ['users', 'venues', 'events', 'hosts', 'host_applications', 'safety_reports', 'admin_audit_logs']
        };

        const allowed = ALLOWED_MAP[adminRole] || [];
        if (!allowed.includes('*') && !allowed.includes(collection)) {
            return NextResponse.json({ error: "Access Denied: Insufficient authority for this dataset." }, { status: 403 });
        }

        const rawData = await adminStore.exportCollection(collection, limit);

        if (rawData.length === 0) {
            return NextResponse.json({ error: "No data available for export" }, { status: 404 });
        }

        // --- 🧹 PII SANITIZATION ---
        const BLOCKED_FIELDS = [
            'password', 'hash', 'salt', 'token', 'refreshToken', 'accessToken',
            'secret', 'key', 'otp', 'emailVerified', 'phoneNumber',
            'stripeId', 'razorpayKey', 'bankDetails', 'authClaims', 'sessionCookie'
        ];

        const data = rawData.map(item => {
            const clean = { ...item };

            if (adminRole !== 'super' && adminRole !== 'finance') {
                if (clean.email) clean.email = '[REDACTED]';
                if (clean.phone) clean.phone = '[REDACTED]';
            }

            BLOCKED_FIELDS.forEach(f => { if (f in clean) clean[f] = '[REDACTED]'; });

            Object.keys(clean).forEach(k => {
                if (typeof clean[k] === 'object' && clean[k] !== null) {
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
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

export const GET = withAdminAuth(handler);
