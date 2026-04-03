import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { requireVenueAccess } from "@/lib/rbac/staffProfileEnforcer";
import { getAdminDb } from "@/lib/firebase/admin";
import { sendTicketEmail } from "@/lib/email";
import { appendOpsLog, buildOpsLogEntry, getOrderDocumentById, normalizeOrderRecord } from "@/lib/server/orderTracking";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ orderId: string }> }
) {
    const { orderId } = await params;
    const ctx = await requireVenueAccess(request, "orders_resendReceipt");
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    try {
        const db = getAdminDb();
        const resolved = await getOrderDocumentById(db, orderId);
        if (!resolved) return NextResponse.json({ error: "Order not found" }, { status: 404 });

        const order = normalizeOrderRecord(resolved.doc, resolved.source);
        const rawOrder = resolved.doc.data() || {};
        if (rawOrder.venueId !== ctx.venueId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }
        if (!order.email) {
            return NextResponse.json({ error: "Order does not have a receipt email" }, { status: 400 });
        }

        const eventDoc = await db.collection("events").doc(rawOrder.eventId).get();
        const event = eventDoc.data() || {};

        const emailResult = await sendTicketEmail({
            to: order.email,
            userName: order.customerName,
            eventName: event.title || order.eventName,
            eventDate: event.startDate || event.date || order.createdAt,
            eventLocation: event.location || event.venueAddress || rawOrder.eventLocation || "",
            eventPosterUrl: event.coverImage || event.image || rawOrder.eventImage || "",
            orderId: order.id,
            tickets: rawOrder.tickets || order.items,
            totalAmount: rawOrder.totalAmount || order.amount,
            eventId: rawOrder.eventId,
            eventVenue: event.venue || rawOrder.eventVenue || "",
            startDate: event.startDate || null,
            endDate: event.endDate || null,
            startTime: event.startTime || rawOrder.eventTime || "",
            endTime: event.endTime || "",
            eventDescription: event.summary || event.description || "",
            isRSVP: Boolean(rawOrder.isRSVP),
            userId: rawOrder.userId || "",
            order: { id: rawOrder.id || order.id, ...rawOrder },
            event,
        });

        const opsEntry = buildOpsLogEntry({
            type: "receipt_resent",
            actorUid: ctx.uid,
            actorName: ctx.baseRole,
        });

        await resolved.doc.ref.update(
            appendOpsLog(
                {
                    lastReceiptSentAt: new Date().toISOString(),
                    receiptResendCount: FieldValue.increment(1),
                },
                opsEntry
            )
        );

        return NextResponse.json({
            success: true,
            orderId,
            orderNumber: order.orderNumber,
            delivery: emailResult.success ? "sent" : "logged_only",
        });
    } catch (error: any) {
        console.error("[venue/orders/[orderId]/resend-receipt]", error?.message || error);
        return NextResponse.json({ error: "Failed to resend receipt" }, { status: 500 });
    }
}
