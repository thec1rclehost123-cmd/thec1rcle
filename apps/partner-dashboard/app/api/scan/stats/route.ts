/**
 * THE C1RCLE - Scanner Stats API
 * Returns real-time event stats for the scanner app
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, isFirebaseConfigured } from "@/lib/firebase/admin";

const ORDERS_COLLECTION = "orders";
const SCANS_COLLECTION = "ticket_scans";
const EVENT_CODES_COLLECTION = "event_codes";
const EVENTS_COLLECTION = "events";

/**
 * GET /api/scan/stats?code=C1R-XXXXXX
 * Refresh live event stats (called from scanner app Stats tab)
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const code = searchParams.get("code");

        if (!code) {
            return NextResponse.json(
                { error: "Event code is required" },
                { status: 400 }
            );
        }

        // Development fallback
        if (!isFirebaseConfigured()) {
            return NextResponse.json({
                totalEntered: 127,
                prebooked: 89,
                doorEntries: 38,
                doorRevenue: 24500,
                byEntryType: {
                    stag: 45,
                    couple: 62,
                    vip: 20,
                },
            });
        }

        const db = getAdminDb();

        // Validate event code & get event ID
        const codeSnapshot = await db
            .collection(EVENT_CODES_COLLECTION)
            .where("code", "==", code.toUpperCase().trim())
            .limit(1)
            .get();

        if (codeSnapshot.empty) {
            return NextResponse.json(
                { error: "Invalid event code" },
                { status: 404 }
            );
        }

        const codeData = codeSnapshot.docs[0].data();

        if (codeData.isRevoked) {
            return NextResponse.json(
                { error: "Event code has been revoked" },
                { status: 403 }
            );
        }

        const eventId = codeData.eventId;

        // Fetch all valid scans for this event
        const scansSnapshot = await db
            .collection(SCANS_COLLECTION)
            .where("eventId", "==", eventId)
            .where("result", "==", "valid")
            .get();

        // Fetch door entry orders
        const doorOrdersSnapshot = await db
            .collection(ORDERS_COLLECTION)
            .where("eventId", "==", eventId)
            .where("source", "==", "door")
            .get();

        // Calculate prebooked entries (scans that aren't door entries)
        const prebookedScans = scansSnapshot.docs.filter(
            (d) => d.data().source !== "door"
        );

        const doorEntries = doorOrdersSnapshot.docs.length;
        const doorRevenue = doorOrdersSnapshot.docs.reduce(
            (sum, d) => sum + (d.data().total || d.data().totalAmount || 0),
            0
        );

        // Count people by entry type from all valid scans
        const byEntryType: Record<string, number> = {};
        scansSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            const et = data.entryType || "general";
            byEntryType[et] = (byEntryType[et] || 0) + (data.quantity || 1);
        });

        // Also count door entry types
        doorOrdersSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            const ticket = data.tickets?.[0] || {};
            const et = ticket.entryType || data.entryType || "general";
            // Only add if not already counted via scans
            if (!scansSnapshot.docs.some((s) => s.data().orderId === doc.id)) {
                byEntryType[et] = (byEntryType[et] || 0) + (ticket.quantity || data.quantity || 1);
            }
        });

        const totalEntered = prebookedScans.reduce(
            (sum, d) => sum + (d.data().quantity || 1),
            0
        ) + doorEntries;

        return NextResponse.json({
            totalEntered,
            prebooked: prebookedScans.length,
            doorEntries,
            doorRevenue,
            byEntryType,
        });
    } catch (error: any) {
        console.error("[Scan Stats API] Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch stats" },
            { status: 500 }
        );
    }
}
