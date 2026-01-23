/**
 * THE C1RCLE - Pending Transfers API
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { getPendingTransfers } from "@/lib/server/ticketShareStore";

export async function GET(request) {
    try {
        const user = await verifyAuth(request);
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const transfers = await getPendingTransfers(user.uid, user.email);

        return NextResponse.json({
            success: true,
            transfers
        });
    } catch (error) {
        console.error("[Pending Transfers API] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
