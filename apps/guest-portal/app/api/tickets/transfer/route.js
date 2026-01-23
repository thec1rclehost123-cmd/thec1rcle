/**
 * THE C1RCLE - Ticket Transfer API
 * Handles formal ownership transfer of tickets
 */

import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import {
    initiateTransfer,
    acceptTransfer,
    cancelTransfer,
    getPendingTransfers,
    getShareBundleByToken
} from "@/lib/server/ticketShareStore";
import { getAdminDb } from "@/lib/firebase/admin";

/**
 * GET /api/tickets/transfer?code=[token]
 * Fetch transfer details for preview
 */
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get("code");

        if (!code) {
            return NextResponse.json({ error: "Code is required" }, { status: 400 });
        }

        const db = getAdminDb();
        const snapshot = await db.collection("transfers")
            .where("token", "==", code)
            .limit(1)
            .get();

        if (snapshot.empty) {
            return NextResponse.json({ error: "Transfer not found or expired" }, { status: 404 });
        }

        const transfer = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };

        // Fetch event details for the preview
        const eventDoc = await db.collection("events").doc(transfer.eventId).get();
        const event = eventDoc.exists ? { id: eventDoc.id, ...eventDoc.data() } : null;

        return NextResponse.json({
            success: true,
            transfer: {
                ...transfer,
                event: {
                    title: event?.title,
                    date: event?.startDate || event?.date,
                    venue: event?.venue || event?.location,
                    posterUrl: event?.image || event?.posterUrl
                }
            }
        });
    } catch (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * POST /api/tickets/transfer
 * Initiate a transfer
 */
export async function POST(request) {
    try {
        const user = await verifyAuth(request);
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { ticketId, recipientEmail } = await request.json();

        if (!ticketId) {
            return NextResponse.json({ error: "ticketId is required" }, { status: 400 });
        }

        const result = await initiateTransfer(ticketId, user.uid, recipientEmail);

        return NextResponse.json({
            success: true,
            transfer: result
        });
    } catch (error) {
        console.error("[Transfer API] Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * PATCH /api/tickets/transfer
 * Accept a ticket transfer
 */
export async function PATCH(request) {
    try {
        const user = await verifyAuth(request);
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { transferCode } = await request.json();

        if (!transferCode) {
            return NextResponse.json({ error: "Transfer code is required" }, { status: 400 });
        }

        const result = await acceptTransfer(transferCode, user.uid);

        return NextResponse.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error("[Transfer API] Accept Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * DELETE /api/tickets/transfer
 * Cancel a pending transfer
 */
export async function DELETE(request) {
    try {
        const user = await verifyAuth(request);
        if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

        const { transferId } = await request.json();

        if (!transferId) {
            return NextResponse.json({ error: "transferId is required" }, { status: 400 });
        }

        const result = await cancelTransfer(transferId, user.uid);

        return NextResponse.json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error("[Transfer API] Cancel Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
