/**
 * THE C1RCLE - Admin Refunds API
 * List and filter refund requests
 */

import { NextResponse } from "next/server";
import { adminStore } from "@/lib/server/adminStore";
import { withAdminAuth } from "@/lib/server/adminMiddleware";

export const dynamic = 'force-dynamic';

async function handler(request) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status') || 'pending';
        const limit = parseInt(searchParams.get('limit') || '50');

        const refunds = await adminStore.getRefunds({ status, limit });

        return NextResponse.json({ refunds, total: refunds.length });
    } catch (error) {
        console.error("GET /api/admin/refunds error:", error);
        return NextResponse.json(
            { error: "Failed to fetch refunds" },
            { status: 500 }
        );
    }
}

export const GET = withAdminAuth(handler);
