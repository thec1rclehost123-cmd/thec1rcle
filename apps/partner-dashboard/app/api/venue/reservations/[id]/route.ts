import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, isFirebaseConfigured } from "@/lib/firebase/admin";

/**
 * PATCH /api/venue/reservations/[id]
 * Update a reservation status (approve / reject)
 */
export async function PATCH(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const { id } = params;
        const body = await req.json();
        const { status } = body;

        if (!id) {
            return NextResponse.json({ error: "Reservation ID is required" }, { status: 400 });
        }

        if (!status || !["approved", "rejected", "cancelled"].includes(status)) {
            return NextResponse.json(
                { error: "Invalid status. Must be 'approved', 'rejected', or 'cancelled'" },
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
        const docRef = db.collection("reservations").doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
            return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
        }

        const now = new Date().toISOString();
        const updateData: Record<string, any> = {
            status,
            updatedAt: now,
        };

        if (status === "approved") {
            updateData.approvedAt = now;
        } else if (status === "rejected") {
            updateData.rejectedAt = now;
        }

        await docRef.update(updateData);

        // Create a notification for the guest (optional — can be used for push later)
        const reservation = doc.data();
        try {
            await db.collection("notifications").add({
                type: "reservation_update",
                userId: reservation?.guestEmail || null,
                venueId: reservation?.venueId,
                title: status === "approved"
                    ? "Reservation Confirmed! 🎉"
                    : "Reservation Update",
                body: status === "approved"
                    ? `Your reservation at ${reservation?.venueName || "the venue"} for ${reservation?.date} has been confirmed.`
                    : `Your reservation request at ${reservation?.venueName || "the venue"} has been ${status}.`,
                reservationId: id,
                status,
                isRead: false,
                createdAt: now,
            });
        } catch (notifErr: any) {
            // Non-critical — don't fail the main action
            console.warn("[Reservations] Notification creation failed:", notifErr.message);
        }

        return NextResponse.json({
            success: true,
            message: `Reservation ${status}`,
            reservation: { id, ...reservation, ...updateData }
        });
    } catch (error: any) {
        console.error("[Reservations API] PATCH error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
