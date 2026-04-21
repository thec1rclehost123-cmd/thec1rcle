import { NextResponse } from "next/server";
import { validateScannerCode, ScannerAuthError } from "@/lib/server/scannerAuth";
import { getAdminDb, isFirebaseConfigured } from "@/lib/firebase/admin";
import { randomUUID } from "node:crypto";

/**
 * POST /api/scanner/walk-in
 * Header: X-Scanner-Code: <code>
 * Body: {
 *   eventId, guestName, guestPhone?, tierId, tierName, entryType,
 *   quantity, unitPrice, totalAmount, paymentMethod, gate?
 * }
 *
 * Creates a walk-in entry in scanner_walk_ins/{entryId}.
 *
 * Response: { success: true, entryId }
 */
export async function POST(request) {
    try {
        const session = await validateScannerCode(request);

        if (!session.canDoorEntry) {
            return NextResponse.json(
                { success: false, error: "This scanner code does not have door entry permission" },
                { status: 403 }
            );
        }

        const body = await request.json();
        const { eventId, guestName, guestPhone, tierId, tierName, entryType, quantity, unitPrice, totalAmount, paymentMethod, gate } = body;

        // Validate required fields
        if (!guestName || !eventId || !tierId) {
            return NextResponse.json(
                { success: false, error: "guestName, eventId, and tierId are required" },
                { status: 400 }
            );
        }

        if (eventId !== session.eventId) {
            return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
        }

        if (!isFirebaseConfigured()) {
            // Dev: just return a fake entryId
            return NextResponse.json({
                success: true,
                entryId: `DEV-${Date.now().toString(36).toUpperCase()}`,
            });
        }

        const db = getAdminDb();
        const entryId = randomUUID();
        const now = new Date().toISOString();

        await db.collection("scanner_walk_ins").doc(entryId).set({
            entryId,
            eventId,
            venueId: session.venueId,
            guestName: guestName.trim(),
            guestPhone: guestPhone?.trim() || null,
            tierId,
            tierName: tierName || "Entry",
            entryType: entryType || "general",
            quantity: Number(quantity) || 1,
            unitPrice: Number(unitPrice) || 0,
            totalAmount: Number(totalAmount) || 0,
            paymentMethod: paymentMethod || "cash",
            gate: gate || session.gate || "Main Gate",
            addedBy: session.code,
            addedAt: now,
            status: "entered",
        });

        return NextResponse.json({ success: true, entryId });

    } catch (error) {
        if (error instanceof ScannerAuthError) {
            return NextResponse.json({ success: false, error: error.message }, { status: error.status });
        }
        console.error("POST /api/scanner/walk-in error", error);
        return NextResponse.json({ success: false, error: "Failed to create entry" }, { status: 500 });
    }
}
