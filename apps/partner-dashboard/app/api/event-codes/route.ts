/**
 * THE C1RCLE - Event Codes Management API
 * Create and manage scanner access codes
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
 * GET /api/event-codes
 * List all codes for an event
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
                        code: "C1R-DEMO01",
                        type: "full",
                        gate: "Main Gate",
                        isRevoked: false,
                        createdAt: new Date().toISOString(),
                        usageCount: 5,
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
        console.error("[Event Codes GET] Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch codes" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/event-codes
 * Create a new access code
 */
export async function POST(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { eventId, type, gate, expiresAt } = body;

        if (!eventId) {
            return NextResponse.json(
                { error: "eventId is required" },
                { status: 400 }
            );
        }

        const now = new Date().toISOString();
        const code = generateEventCode();

        const codeData = {
            code,
            eventId,
            venueId: null as string | null,
            type: type || "full", // 'full' or 'scan_only'
            gate: gate || null,
            isRevoked: false,
            createdBy: {
                uid: auth.uid,
                name: auth.name || auth.email,
            },
            createdAt: now,
            expiresAt: expiresAt || null,
            usageCount: 0,
            lastUsedAt: null,
            stats: {
                scansCount: 0,
                doorEntriesCount: 0,
                doorRevenue: 0,
            },
        };

        if (!isFirebaseConfigured()) {
            return NextResponse.json({
                success: true,
                code: { id: "demo_new", ...codeData },
            });
        }

        const db = getAdminDb();

        // Verify event exists
        const eventDoc = await db.collection(EVENTS_COLLECTION).doc(eventId).get();
        if (!eventDoc.exists) {
            return NextResponse.json({ error: "Event not found" }, { status: 404 });
        }

        // Add venueId to code data
        const eventData = eventDoc.data();
        codeData.venueId = eventData?.venueId;

        // Create the code
        const docRef = await db.collection(EVENT_CODES_COLLECTION).add(codeData);

        return NextResponse.json({
            success: true,
            code: { id: docRef.id, ...codeData },
        });
    } catch (error: any) {
        console.error("[Event Codes POST] Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to create code" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/event-codes
 * Revoke an access code
 */
export async function DELETE(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const codeId = searchParams.get("id");
        const code = searchParams.get("code");

        if (!codeId && !code) {
            return NextResponse.json(
                { error: "id or code is required" },
                { status: 400 }
            );
        }

        if (!isFirebaseConfigured()) {
            return NextResponse.json({ success: true });
        }

        const db = getAdminDb();
        let docRef;

        if (codeId) {
            docRef = db.collection(EVENT_CODES_COLLECTION).doc(codeId);
        } else {
            const snapshot = await db
                .collection(EVENT_CODES_COLLECTION)
                .where("code", "==", code?.toUpperCase())
                .limit(1)
                .get();

            if (snapshot.empty) {
                return NextResponse.json({ error: "Code not found" }, { status: 404 });
            }

            docRef = snapshot.docs[0].ref;
        }

        await docRef.update({
            isRevoked: true,
            revokedAt: new Date().toISOString(),
            revokedBy: {
                uid: auth.uid,
                name: auth.name || auth.email,
            },
        });

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("[Event Codes DELETE] Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to revoke code" },
            { status: 500 }
        );
    }
}
