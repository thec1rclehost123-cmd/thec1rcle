import { NextResponse } from "next/server";
import { getAdminDb, isFirebaseConfigured } from "../../../lib/firebase/admin";

/**
 * POST /api/reservations
 * Creates a new reservation request.
 * 
 * For restaurant bookings: creates a pending request for venue approval.
 * For event bookings: creates a reservation with optional payment link.
 */
export async function POST(request) {
    try {
        const body = await request.json();

        const {
            venueId,
            venueName,
            date,
            time,
            guests,
            bookingType, // "event" | "restaurant"
            guestName,
            guestPhone,
            specialRequests,
            // Event-specific
            eventId,
            eventTitle,
            tableId,
            tableName,
            tablePrice,
            tierId,
            tierName,
            tierPrice,
        } = body;

        // Validate required fields
        if (!venueId || !date || !guests || !bookingType) {
            return NextResponse.json(
                { error: "Missing required fields: venueId, date, guests, bookingType" },
                { status: 400 }
            );
        }

        // Build reservation document
        const reservation = {
            venueId,
            venueName: venueName || "",
            date: new Date(date),
            time: time || "",
            guests: Number(guests),
            bookingType,
            guestName: guestName || "Guest",
            guestPhone: guestPhone || "",
            specialRequests: specialRequests || "",
            status: "pending",
            createdAt: new Date(),
            updatedAt: new Date(),
        };

        // Add event-specific fields
        if (bookingType === "event") {
            reservation.eventId = eventId || null;
            reservation.eventTitle = eventTitle || "";
            reservation.tableId = tableId || null;
            reservation.tableName = tableName || "";
            reservation.tablePrice = Number(tablePrice) || 0;
            reservation.tierId = tierId || null;
            reservation.tierName = tierName || "";
            reservation.tierPrice = Number(tierPrice) || 0;

            // Calculate total
            reservation.totalAmount = reservation.tablePrice || (reservation.tierPrice * reservation.guests);

            // If there's a price, mark as awaiting_payment
            if (reservation.totalAmount > 0) {
                reservation.status = "awaiting_payment";
            }
        }

        // Require Firebase — no toy mode
        if (!isFirebaseConfigured()) {
            return NextResponse.json(
                { error: "Server not configured. Contact support." },
                { status: 500 }
            );
        }

        const db = getAdminDb();
        const docRef = await db.collection("reservations").add(reservation);

        // Also create a notification for the venue
        await db.collection("notifications").add({
            type: "reservation_request",
            venueId,
            reservationId: docRef.id,
            title: `New ${bookingType === "event" ? "Event" : "Restaurant"} Reservation`,
            body: `${guestName || "A guest"} requested a ${bookingType === "event" ? "table" : "dining"} reservation for ${guests} guests on ${new Date(date).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}`,
            read: false,
            createdAt: new Date(),
        });

        return NextResponse.json({
            success: true,
            reservationId: docRef.id,
            status: reservation.status,
            message: reservation.status === "awaiting_payment"
                ? "Reservation created. Proceed to payment."
                : "Reservation request submitted. You'll be notified when confirmed.",
        });

    } catch (error) {
        console.error("[API] Reservation error:", error);
        return NextResponse.json(
            { error: "Failed to create reservation", details: error.message },
            { status: 500 }
        );
    }
}

/**
 * GET /api/reservations?venueId=xxx&status=pending
 * Lists reservations for a venue (used by partner dashboard).
 */
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const venueId = searchParams.get("venueId");
        const status = searchParams.get("status");
        const limit = parseInt(searchParams.get("limit") || "50");

        if (!venueId) {
            return NextResponse.json(
                { error: "venueId is required" },
                { status: 400 }
            );
        }

        if (!isFirebaseConfigured()) {
            return NextResponse.json(
                { error: "Server not configured. Contact support." },
                { status: 500 }
            );
        }

        const db = getAdminDb();

        let query = db.collection("reservations").where("venueId", "==", venueId);

        if (status) {
            query = query.where("status", "==", status);
        }

        query = query.orderBy("createdAt", "desc").limit(limit);

        const snapshot = await query.get();
        const reservations = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            date: doc.data().date?.toDate?.()?.toISOString() || doc.data().date,
            createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
            updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt,
        }));

        return NextResponse.json({
            reservations,
            total: reservations.length,
        });

    } catch (error) {
        console.error("[API] List reservations error:", error);
        return NextResponse.json(
            { error: "Failed to list reservations", details: error.message },
            { status: 500 }
        );
    }
}
