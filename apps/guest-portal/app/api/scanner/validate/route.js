import { NextResponse } from "next/server";
import { getAdminDb, isFirebaseConfigured } from "@/lib/firebase/admin";

/**
 * POST /api/scanner/validate
 * Body: { code: string }
 *
 * Validates the event code against scanner_sessions, fetches the event,
 * and returns everything the scanner-app needs to bootstrap.
 */
export async function POST(request) {
    try {
        const { code } = await request.json();

        if (!code || typeof code !== "string" || code.trim().length === 0) {
            return NextResponse.json({ valid: false, error: "Code is required" }, { status: 400 });
        }

        const normalized = code.trim().toUpperCase();

        if (!isFirebaseConfigured()) {
            return NextResponse.json(buildDevResponse(normalized));
        }

        const db = getAdminDb();

        // Look up the scanner session by code (document ID = code)
        const sessionSnap = await db.collection("scanner_sessions").doc(normalized).get();
        if (!sessionSnap.exists) {
            return NextResponse.json({ valid: false, error: "Invalid or expired code" }, { status: 404 });
        }

        const session = sessionSnap.data();
        const expiresAt = session.expiresAt?.toDate?.() || new Date(session.expiresAt);
        if (expiresAt < new Date()) {
            return NextResponse.json({ valid: false, error: "Scanner code has expired" }, { status: 401 });
        }

        // Fetch the event
        const eventSnap = await db.collection("events").doc(session.eventId).get();
        if (!eventSnap.exists) {
            return NextResponse.json({ valid: false, error: "Event not found" }, { status: 404 });
        }

        const event = eventSnap.data();

        // Map ticket tiers from the event document
        const tiers = (event.tickets || []).map((t, i) => ({
            id: t.id || `tier_${i}`,
            name: t.name || t.tierName || "Entry",
            price: Number(t.price) || 0,
            entryType: t.entryType || t.gender || "general",
            available: t.available !== false && (t.quantity == null || t.quantity > 0),
        }));

        // Aggregate basic stats
        const [confirmedOrdersSnap, walkInsSnap] = await Promise.all([
            db.collection("orders")
                .where("eventId", "==", session.eventId)
                .where("status", "==", "confirmed")
                .get(),
            db.collection("scanner_walk_ins")
                .where("eventId", "==", session.eventId)
                .get(),
        ]);

        const scannedSnap = await db.collection("ticket_scans")
            .where("eventId", "==", session.eventId)
            .get();

        const doorEntries = walkInsSnap.size;
        const doorRevenue = walkInsSnap.docs.reduce(
            (sum, d) => sum + (Number(d.data().totalAmount) || 0),
            0
        );

        return NextResponse.json({
            valid: true,
            event: {
                id: session.eventId,
                title: event.title || event.name || "Event",
                venue: event.venue || event.venueName || "",
                venueId: session.venueId,
                date: event.startDate || event.date || "",
                startTime: event.startTime || "",
                endTime: event.endTime || "",
                capacity: Number(event.capacity) || 500,
            },
            tiers,
            permissions: {
                canScan: session.canScan ?? true,
                canDoorEntry: session.canDoorEntry ?? false,
            },
            gate: session.gate || "Main Gate",
            stats: {
                totalEntered: scannedSnap.size,
                prebooked: confirmedOrdersSnap.size,
                doorEntries,
                doorRevenue,
            },
        });

    } catch (error) {
        console.error("POST /api/scanner/validate error", error);
        return NextResponse.json({ valid: false, error: "Failed to validate code" }, { status: 500 });
    }
}

function buildDevResponse(code) {
    return {
        valid: true,
        event: {
            id: "dev_event_001",
            title: "Dev Night — Test Event",
            venue: "Club Dev",
            venueId: "dev_venue_001",
            date: new Date().toISOString().split("T")[0],
            startTime: "22:00",
            endTime: "04:00",
            capacity: 500,
        },
        tiers: [
            { id: "stag", name: "Stag Entry", price: 500, entryType: "stag", available: true },
            { id: "couple", name: "Couple Entry", price: 800, entryType: "couple", available: true },
            { id: "vip", name: "VIP Entry", price: 2000, entryType: "vip", available: true },
        ],
        permissions: { canScan: true, canDoorEntry: true },
        gate: "Main Gate",
        stats: { totalEntered: 0, prebooked: 0, doorEntries: 0, doorRevenue: 0 },
    };
}
