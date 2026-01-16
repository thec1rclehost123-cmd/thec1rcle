/**
 * THE C1RCLE - Event Code API
 * Manages scanner access codes for events
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, isFirebaseConfigured } from "@/lib/firebase/admin";
import { verifyAuth } from "@/lib/server/auth";
import { randomBytes } from "node:crypto";

const EVENT_CODES_COLLECTION = "event_codes";
const EVENTS_COLLECTION = "events";

/**
 * Generate a unique event code
 */
function generateEventCode(): string {
    const prefix = "C1R";
    const random = randomBytes(3).toString("hex").toUpperCase();
    return `${prefix}-${random}`;
}

/**
 * POST /api/scan/auth
 * Validate an event code (called from Scanner App)
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { code } = body;

        if (!code) {
            return NextResponse.json(
                { valid: false, error: "Event code is required" },
                { status: 400 }
            );
        }

        const normalizedCode = code.toUpperCase().trim();

        // Development fallback
        if (!isFirebaseConfigured()) {
            return NextResponse.json(getMockEventData(normalizedCode));
        }

        const db = getAdminDb();

        // Find the event code
        const codeSnapshot = await db
            .collection(EVENT_CODES_COLLECTION)
            .where("code", "==", normalizedCode)
            .limit(1)
            .get();

        if (codeSnapshot.empty) {
            return NextResponse.json(
                { valid: false, error: "Invalid event code" },
                { status: 404 }
            );
        }

        const codeDoc = codeSnapshot.docs[0];
        const codeData = codeDoc.data();

        // Check if revoked
        if (codeData.isRevoked) {
            return NextResponse.json(
                { valid: false, error: "This code has been revoked" },
                { status: 403 }
            );
        }

        // Check expiration
        if (codeData.expiresAt && new Date(codeData.expiresAt) < new Date()) {
            return NextResponse.json(
                { valid: false, error: "This code has expired" },
                { status: 403 }
            );
        }

        // Get the event
        const eventDoc = await db
            .collection(EVENTS_COLLECTION)
            .doc(codeData.eventId)
            .get();

        if (!eventDoc.exists) {
            return NextResponse.json(
                { valid: false, error: "Event not found" },
                { status: 404 }
            );
        }

        const event = eventDoc.data();

        // Update last used timestamp
        await codeDoc.ref.update({
            lastUsedAt: new Date().toISOString(),
            usageCount: (codeData.usageCount || 0) + 1,
        });

        // Get ticket tiers
        const tiers = (event?.tickets || []).map((t: any) => ({
            id: t.id || t.ticketId,
            name: t.name,
            price: t.price || t.basePrice || 0,
            entryType: t.entryType || "general",
            available: (t.remaining || t.quantity || 0) > 0,
        }));

        // Get entry stats
        const scansSnapshot = await db
            .collection("ticket_scans")
            .where("eventId", "==", codeData.eventId)
            .where("result", "==", "valid")
            .get();

        const ordersSnapshot = await db
            .collection("orders")
            .where("eventId", "==", codeData.eventId)
            .where("source", "==", "door")
            .get();

        const prebookedEntered = scansSnapshot.docs.filter(
            (d) => d.data().source !== "door"
        ).length;
        const doorEntries = ordersSnapshot.docs.length;
        const doorRevenue = ordersSnapshot.docs.reduce(
            (sum, d) => sum + (d.data().total || 0),
            0
        );

        return NextResponse.json({
            valid: true,
            code: normalizedCode,
            event: {
                id: eventDoc.id,
                title: event?.title || event?.name,
                venue: event?.venueName || event?.venue?.name,
                venueId: event?.venueId,
                date: event?.date,
                startTime: event?.startTime,
                endTime: event?.endTime,
                capacity: event?.capacity || 500,
                imageUrl: event?.coverImage || event?.image,
            },
            permissions: {
                canScan: codeData.type === "full" || codeData.type === "scan_only",
                canDoorEntry: codeData.type === "full",
            },
            tiers,
            gate: codeData.gate || null,
            stats: {
                totalEntered: prebookedEntered + doorEntries,
                prebooked: prebookedEntered,
                doorEntries,
                doorRevenue,
            },
        });
    } catch (error: any) {
        console.error("[Event Code Auth] Error:", error);
        return NextResponse.json(
            { valid: false, error: error.message || "Authentication failed" },
            { status: 500 }
        );
    }
}

/**
 * GET /api/scan/auth
 * List event codes for an event (requires auth)
 */
export async function GET(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const eventId = searchParams.get("eventId");

        if (!eventId) {
            return NextResponse.json(
                { error: "eventId is required" },
                { status: 400 }
            );
        }

        if (!isFirebaseConfigured()) {
            return NextResponse.json({
                codes: [
                    {
                        id: "demo1",
                        code: "C1R-DEMO1",
                        type: "full",
                        gate: "Main Gate",
                        createdAt: new Date().toISOString(),
                    },
                ],
            });
        }

        const db = getAdminDb();
        const snapshot = await db
            .collection(EVENT_CODES_COLLECTION)
            .where("eventId", "==", eventId)
            .orderBy("createdAt", "desc")
            .get();

        const codes = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        }));

        return NextResponse.json({ codes });
    } catch (error: any) {
        console.error("[Event Code List] Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch codes" },
            { status: 500 }
        );
    }
}

/**
 * Mock data for development
 */
function getMockEventData(code: string) {
    return {
        valid: true,
        code,
        event: {
            id: "evt_demo_123",
            title: "Saturday Night Live",
            venue: "Club Paradiso",
            venueId: "venue_demo_456",
            date: new Date().toISOString().split("T")[0],
            startTime: "22:00",
            endTime: "04:00",
            capacity: 500,
        },
        permissions: {
            canScan: true,
            canDoorEntry: true,
        },
        tiers: [
            { id: "tier_stag", name: "Stag Entry", price: 500, entryType: "stag", available: true },
            { id: "tier_couple", name: "Couple Entry", price: 800, entryType: "couple", available: true },
            { id: "tier_vip", name: "VIP Entry", price: 2000, entryType: "vip", available: true },
        ],
        gate: "Main Gate",
        stats: {
            totalEntered: 127,
            prebooked: 89,
            doorEntries: 38,
            doorRevenue: 24500,
        },
    };
}
