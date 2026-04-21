import { NextResponse } from "next/server";
import { validateScannerCode, ScannerAuthError } from "@/lib/server/scannerAuth";
import { getAdminDb, isFirebaseConfigured } from "@/lib/firebase/admin";

/**
 * GET /api/scanner/guestlist?eventId=<id>
 * Header: X-Scanner-Code: <code>
 *
 * Returns a merged guestlist combining:
 *   - Confirmed ticket orders  (source: "online")
 *   - Scanner walk-in entries  (source: "door")
 *
 * Each entry includes scan status derived from ticket_scans.
 *
 * Response: { guests: GuestEntry[] }
 */
export async function GET(request) {
    try {
        const session = await validateScannerCode(request);

        const { searchParams } = new URL(request.url);
        const eventId = searchParams.get("eventId");

        if (!eventId) {
            return NextResponse.json({ error: "eventId is required" }, { status: 400 });
        }

        // Prevent a scanner from querying a different event
        if (eventId !== session.eventId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        if (!isFirebaseConfigured()) {
            return NextResponse.json({ guests: buildDevGuests() });
        }

        const db = getAdminDb();

        // Run all three reads in parallel
        const [ordersSnap, scansSnap, walkInsSnap] = await Promise.all([
            db.collection("orders")
                .where("eventId", "==", eventId)
                .where("status", "==", "confirmed")
                .limit(500)
                .get(),
            db.collection("ticket_scans")
                .where("eventId", "==", eventId)
                .get(),
            db.collection("scanner_walk_ins")
                .where("eventId", "==", eventId)
                .get(),
        ]);

        // Build a Set of scanned orderId/ticketId values for O(1) lookup
        const scannedOrderIds = new Set(
            scansSnap.docs.map((d) => d.data().orderId || d.data().ticketId).filter(Boolean)
        );

        // Map confirmed orders
        const orderGuests = ordersSnap.docs.map((doc) => {
            const o = doc.data();
            const isScanned = scannedOrderIds.has(doc.id);
            const scanDoc = isScanned
                ? scansSnap.docs.find((d) => (d.data().orderId || d.data().ticketId) === doc.id)
                : null;

            return {
                id: doc.id,
                name: o.userName || o.guestName || "Guest",
                ticketType: o.ticketName || o.tierName || "Entry",
                entryType: o.entryType || o.gender || "general",
                quantity: Number(o.quantity) || 1,
                source: "online",
                status: isScanned ? "entered" : "not_entered",
                enteredAt: isScanned ? (scanDoc?.data()?.scannedAt || null) : null,
            };
        });

        // Map walk-in / door entries
        const doorGuests = walkInsSnap.docs.map((doc) => {
            const w = doc.data();
            return {
                id: doc.id,
                name: w.guestName || "Door Guest",
                ticketType: w.tierName || "Door Entry",
                entryType: w.entryType || "general",
                quantity: Number(w.quantity) || 1,
                source: "door",
                status: "entered",
                enteredAt: w.addedAt || null,
            };
        });

        return NextResponse.json({
            guests: [...orderGuests, ...doorGuests],
        });

    } catch (error) {
        if (error instanceof ScannerAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("GET /api/scanner/guestlist error", error);
        return NextResponse.json({ error: "Failed to load guestlist" }, { status: 500 });
    }
}

function buildDevGuests() {
    const names = ["Arjun Sharma", "Priya Patel", "Rahul Verma", "Ananya Singh", "Vikram Kapoor"];
    return names.map((name, i) => ({
        id: `dev_guest_${i}`,
        name,
        ticketType: i % 2 === 0 ? "Stag Entry" : "Couple Entry",
        entryType: i % 2 === 0 ? "stag" : "couple",
        quantity: i % 2 === 0 ? 1 : 2,
        source: i === 4 ? "door" : "online",
        status: i < 3 ? "entered" : "not_entered",
        enteredAt: i < 3 ? new Date(Date.now() - i * 600000).toISOString() : null,
    }));
}
