/**
 * THE C1RCLE - Door Entry API
 * Creates walk-up entries at the door
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, isFirebaseConfigured } from "@/lib/firebase/admin";
import { randomBytes, createHmac } from "node:crypto";

const ORDERS_COLLECTION = "orders";
const EVENTS_COLLECTION = "events";
const EVENT_CODES_COLLECTION = "event_codes";
const SCANS_COLLECTION = "ticket_scans";
const QR_SECRET = process.env.QR_SECRET_KEY || "c1rcle-qr-secret-2024";

/**
 * POST /api/door-entry
 * Create a door entry (walk-up sale)
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const {
            eventCode,
            eventId,
            guestName,
            guestPhone,
            tierId,
            tierName,
            entryType,
            quantity,
            unitPrice,
            totalAmount,
            paymentMethod,
            gate,
        } = body;

        // Validation
        if (!eventCode || !eventId || !guestName || !tierId) {
            return NextResponse.json(
                { success: false, error: "Missing required fields" },
                { status: 400 }
            );
        }

        const now = new Date().toISOString();
        const orderId = `DOOR-${randomBytes(4).toString("hex").toUpperCase()}`;
        const ticketId = `TKT-${randomBytes(3).toString("hex").toUpperCase()}`;

        // Generate QR payload
        const timestamp = Date.now();
        const qrPayload = {
            o: orderId,
            e: eventId,
            t: ticketId,
            n: tierName,
            u: `guest_${timestamp}`,
            q: quantity || 1,
            et: entryType || "general",
            ts: timestamp,
            v: 1,
        };

        // Sign the QR
        const dataToSign = `${qrPayload.o}:${qrPayload.e}:${qrPayload.t}:${qrPayload.u}:${qrPayload.q}:${qrPayload.ts}`;
        const signature = createHmac("sha256", QR_SECRET)
            .update(dataToSign)
            .digest("hex")
            .substring(0, 16);

        (qrPayload as any).sig = signature;

        // Development fallback
        if (!isFirebaseConfigured()) {
            return NextResponse.json({
                success: true,
                orderId,
                entryId: `ENT-${randomBytes(3).toString("hex").toUpperCase()}`,
                qrData: JSON.stringify(qrPayload),
            });
        }

        const db = getAdminDb();

        // Validate event code
        const codeSnapshot = await db
            .collection(EVENT_CODES_COLLECTION)
            .where("code", "==", eventCode.toUpperCase())
            .limit(1)
            .get();

        if (codeSnapshot.empty) {
            return NextResponse.json(
                { success: false, error: "Invalid event code" },
                { status: 403 }
            );
        }

        const codeData = codeSnapshot.docs[0].data();

        if (codeData.type !== "full") {
            return NextResponse.json(
                { success: false, error: "Door entry not permitted for this code" },
                { status: 403 }
            );
        }

        // Create order document
        const order = {
            id: orderId,
            eventId,
            source: "door",
            status: "confirmed",

            // Guest info
            userName: guestName,
            userPhone: guestPhone || null,
            userId: qrPayload.u,

            // Ticket details
            tickets: [
                {
                    ticketId,
                    tierId,
                    name: tierName,
                    entryType: entryType || "general",
                    quantity: quantity || 1,
                    unitPrice: unitPrice || 0,
                    subtotal: totalAmount || 0,
                },
            ],

            // Pricing
            subtotal: totalAmount || 0,
            total: totalAmount || 0,
            currency: "INR",

            // Payment
            paymentMethod: paymentMethod || "cash",
            paymentStatus: "collected",

            // Door entry metadata
            doorEntryMeta: {
                eventCode: eventCode.toUpperCase(),
                gate: gate || null,
                collectedAt: now,
            },

            // QR
            qrPayload,
            qrData: JSON.stringify(qrPayload),

            // Timestamps
            createdAt: now,
            confirmedAt: now,
            checkedInAt: now,
        };

        // Create scan record (they're entering now)
        const scanRecord = {
            orderId,
            eventId,
            ticketId,
            userId: qrPayload.u,
            quantity: quantity || 1,
            entryType: entryType || "general",
            result: "valid",
            source: "door",
            scannedBy: {
                uid: `scanner_${eventCode}`,
                name: "Door Entry",
                role: "door_staff",
            },
            device: {
                id: gate || "door",
                bound: false,
            },
            scannedAt: now,
            createdAt: now,
        };

        // Use transaction for atomicity
        await db.runTransaction(async (transaction) => {
            // Create order
            transaction.set(db.collection(ORDERS_COLLECTION).doc(orderId), order);

            // Create scan
            transaction.set(
                db.collection(SCANS_COLLECTION).doc(`${orderId}_scan`),
                scanRecord
            );

            // Update event code stats
            transaction.update(codeSnapshot.docs[0].ref, {
                "stats.doorEntriesCount": (codeData.stats?.doorEntriesCount || 0) + 1,
                "stats.doorRevenue": (codeData.stats?.doorRevenue || 0) + (totalAmount || 0),
            });

            // Update event inventory (decrement remaining)
            const eventRef = db.collection(EVENTS_COLLECTION).doc(eventId);
            const eventDoc = await transaction.get(eventRef);

            if (eventDoc.exists) {
                const eventData = eventDoc.data();
                const tickets = eventData?.tickets || [];
                const tierIndex = tickets.findIndex((t: any) => t.id === tierId || t.ticketId === tierId);

                if (tierIndex >= 0) {
                    const tier = tickets[tierIndex];
                    const newRemaining = Math.max(0, (tier.remaining || tier.quantity || 0) - (quantity || 1));
                    tickets[tierIndex] = { ...tier, remaining: newRemaining };
                    transaction.update(eventRef, { tickets });
                }
            }
        });

        return NextResponse.json({
            success: true,
            orderId,
            entryId: scanRecord.orderId,
            qrData: JSON.stringify(qrPayload),
        });
    } catch (error: any) {
        console.error("[Door Entry] Error:", error);
        return NextResponse.json(
            { success: false, error: error.message || "Failed to create door entry" },
            { status: 500 }
        );
    }
}

/**
 * GET /api/door-entry
 * Get door entry stats for an event
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const eventId = searchParams.get("eventId");
        const eventCode = searchParams.get("eventCode");

        if (!eventId && !eventCode) {
            return NextResponse.json(
                { error: "eventId or eventCode required" },
                { status: 400 }
            );
        }

        if (!isFirebaseConfigured()) {
            return NextResponse.json({
                doorEntries: 38,
                doorRevenue: 24500,
                byPaymentMethod: {
                    cash: 15000,
                    upi: 7500,
                    card: 2000,
                },
            });
        }

        const db = getAdminDb();

        let targetEventId = eventId;

        if (!targetEventId && eventCode) {
            const codeSnapshot = await db
                .collection(EVENT_CODES_COLLECTION)
                .where("code", "==", eventCode.toUpperCase())
                .limit(1)
                .get();

            if (!codeSnapshot.empty) {
                targetEventId = codeSnapshot.docs[0].data().eventId;
            }
        }

        if (!targetEventId) {
            return NextResponse.json({ error: "Event not found" }, { status: 404 });
        }

        const ordersSnapshot = await db
            .collection(ORDERS_COLLECTION)
            .where("eventId", "==", targetEventId)
            .where("source", "==", "door")
            .get();

        let doorEntries = 0;
        let doorRevenue = 0;
        const byPaymentMethod: Record<string, number> = {};

        ordersSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            doorEntries += 1;
            doorRevenue += data.total || 0;

            const method = data.paymentMethod || "cash";
            byPaymentMethod[method] = (byPaymentMethod[method] || 0) + (data.total || 0);
        });

        return NextResponse.json({
            doorEntries,
            doorRevenue,
            byPaymentMethod,
        });
    } catch (error: any) {
        console.error("[Door Entry Stats] Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch stats" },
            { status: 500 }
        );
    }
}
