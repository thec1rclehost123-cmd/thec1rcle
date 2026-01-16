/**
 * THE C1RCLE - Guest List API
 * Returns guest list for scanner app
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, isFirebaseConfigured } from "@/lib/firebase/admin";

const ORDERS_COLLECTION = "orders";
const SCANS_COLLECTION = "ticket_scans";
const EVENT_CODES_COLLECTION = "event_codes";

/**
 * GET /api/guestlist
 * Get guest list for an event
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const eventId = searchParams.get("eventId");
        const eventCode = searchParams.get("eventCode");

        if (!eventId) {
            return NextResponse.json(
                { error: "eventId is required" },
                { status: 400 }
            );
        }

        // Development fallback
        if (!isFirebaseConfigured()) {
            return NextResponse.json({ guests: getMockGuests() });
        }

        const db = getAdminDb();

        // Validate event code if provided
        if (eventCode) {
            const codeSnapshot = await db
                .collection(EVENT_CODES_COLLECTION)
                .where("code", "==", eventCode.toUpperCase())
                .limit(1)
                .get();

            if (codeSnapshot.empty) {
                return NextResponse.json(
                    { error: "Invalid event code" },
                    { status: 403 }
                );
            }
        }

        // Get all orders for this event
        const ordersSnapshot = await db
            .collection(ORDERS_COLLECTION)
            .where("eventId", "==", eventId)
            .where("status", "in", ["confirmed", "checked_in"])
            .get();

        // Get all scans for this event
        const scansSnapshot = await db
            .collection(SCANS_COLLECTION)
            .where("eventId", "==", eventId)
            .where("result", "==", "valid")
            .get();

        // Create a set of scanned order IDs
        const scannedOrderIds = new Set<string>();
        const scanTimes = new Map<string, string>();

        scansSnapshot.docs.forEach((doc) => {
            const data = doc.data();
            scannedOrderIds.add(data.orderId);
            scanTimes.set(data.orderId, data.scannedAt);
        });

        // Map orders to guest list
        const guests = ordersSnapshot.docs.map((doc) => {
            const order = doc.data();
            const orderId = doc.id;
            const ticket = order.tickets?.[0] || {};
            const entered = scannedOrderIds.has(orderId) || order.status === "checked_in";

            return {
                id: orderId,
                name: order.userName || order.customerName || "Guest",
                ticketType: ticket.name || "Entry",
                entryType: ticket.entryType || "general",
                quantity: ticket.quantity || 1,
                source: order.source || "online",
                status: entered ? "entered" : "not_entered",
                enteredAt: scanTimes.get(orderId) || order.checkedInAt || null,
            };
        });

        // Sort: not entered first, then by name
        guests.sort((a, b) => {
            if (a.status !== b.status) {
                return a.status === "not_entered" ? -1 : 1;
            }
            return a.name.localeCompare(b.name);
        });

        return NextResponse.json({ guests });
    } catch (error: any) {
        console.error("[Guestlist API] Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch guest list" },
            { status: 500 }
        );
    }
}

/**
 * Mock data for development
 */
function getMockGuests() {
    const names = [
        "Arjun Sharma", "Priya Patel", "Rahul Verma", "Ananya Singh",
        "Vikram Kapoor", "Neha Gupta", "Rohan Malhotra", "Kavya Reddy",
        "Aditya Kumar", "Ishita Joshi", "Karan Mehta", "Pooja Nair",
    ];

    const ticketTypes = [
        { name: "Stag Entry", entryType: "stag" },
        { name: "Couple Entry", entryType: "couple" },
        { name: "VIP Entry", entryType: "vip" },
    ];

    return names.map((name, index) => {
        const ticket = ticketTypes[index % ticketTypes.length];
        const entered = Math.random() > 0.4;
        const isDoor = Math.random() > 0.75;

        return {
            id: `guest_${index}`,
            name,
            ticketType: ticket.name,
            entryType: ticket.entryType,
            quantity: ticket.entryType === "couple" ? 2 : 1,
            source: isDoor ? "door" : "online",
            status: entered ? "entered" : "not_entered",
            enteredAt: entered
                ? new Date(Date.now() - Math.random() * 3600000).toISOString()
                : null,
        };
    });
}
