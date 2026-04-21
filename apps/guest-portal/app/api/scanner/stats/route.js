import { NextResponse } from "next/server";
import { validateScannerCode, ScannerAuthError } from "@/lib/server/scannerAuth";
import { getAdminDb, isFirebaseConfigured } from "@/lib/firebase/admin";

/**
 * GET /api/scanner/stats?eventId=<id>
 * Header: X-Scanner-Code: <code>
 *
 * Returns live event entry statistics.
 *
 * Response: {
 *   totalEntered, prebooked, doorEntries, doorRevenue, capacity, byEntryType
 * }
 */
export async function GET(request) {
    try {
        const session = await validateScannerCode(request);

        const { searchParams } = new URL(request.url);
        const eventId = searchParams.get("eventId");

        if (!eventId) {
            return NextResponse.json({ error: "eventId is required" }, { status: 400 });
        }

        if (eventId !== session.eventId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        if (!isFirebaseConfigured()) {
            return NextResponse.json(buildDevStats());
        }

        const db = getAdminDb();

        const [scansSnap, ordersSnap, walkInsSnap, eventSnap] = await Promise.all([
            db.collection("ticket_scans").where("eventId", "==", eventId).get(),
            db.collection("orders").where("eventId", "==", eventId).where("status", "==", "confirmed").get(),
            db.collection("scanner_walk_ins").where("eventId", "==", eventId).get(),
            db.collection("events").doc(eventId).get(),
        ]);

        const capacity = eventSnap.exists ? Number(eventSnap.data().capacity) || 500 : 500;

        // Door revenue and entries from walk-ins
        let doorRevenue = 0;
        const walkInByEntryType = {};
        walkInsSnap.docs.forEach((doc) => {
            const w = doc.data();
            doorRevenue += Number(w.totalAmount) || 0;
            const et = w.entryType || "general";
            walkInByEntryType[et] = (walkInByEntryType[et] || 0) + (Number(w.quantity) || 1);
        });

        // Entry-type breakdown from ticket scans
        const scanByEntryType = {};
        scansSnap.docs.forEach((doc) => {
            const s = doc.data();
            const et = s.entryType || s.gender || "general";
            scanByEntryType[et] = (scanByEntryType[et] || 0) + 1;
        });

        // Merge both entry-type maps
        const allEntryTypes = new Set([
            ...Object.keys(scanByEntryType),
            ...Object.keys(walkInByEntryType),
        ]);
        const byEntryType = {};
        allEntryTypes.forEach((et) => {
            byEntryType[et] = (scanByEntryType[et] || 0) + (walkInByEntryType[et] || 0);
        });

        return NextResponse.json({
            totalEntered: scansSnap.size + walkInsSnap.size,
            prebooked: ordersSnap.size,
            doorEntries: walkInsSnap.size,
            doorRevenue,
            capacity,
            byEntryType,
        });

    } catch (error) {
        if (error instanceof ScannerAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("GET /api/scanner/stats error", error);
        return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
    }
}

function buildDevStats() {
    return {
        totalEntered: 0,
        prebooked: 0,
        doorEntries: 0,
        doorRevenue: 0,
        capacity: 500,
        byEntryType: {},
    };
}
