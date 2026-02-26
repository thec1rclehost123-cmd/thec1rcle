/**
 * THE C1RCLE - Admin Refund Rejection API
 */

import { NextResponse } from "next/server";
import { adminStore } from "@/lib/server/adminStore";
import { withAdminAuth } from "@/lib/server/adminMiddleware";

export const dynamic = 'force-dynamic';

async function handler(request, { params }) {
    try {
        const refundId = params.id;
        const admin = request.user;
        const body = await request.json();
        const { reason } = body;

        if (!reason) {
            return NextResponse.json({ error: "Rejection reason is required" }, { status: 400 });
        }

        await adminStore.rejectRefundRequest(refundId, reason, admin);

        return NextResponse.json({ success: true, message: 'Refund request rejected' });
    } catch (error) {
        console.error("POST /api/admin/refunds/[id]/reject error:", error);
        const status = error.message.includes('not found') ? 404
            : error.message.includes('already') ? 400 : 500;
        return NextResponse.json(
            { error: error.message || "Failed to reject refund" },
            { status }
        );
    }
}

export const POST = withAdminAuth(handler);
