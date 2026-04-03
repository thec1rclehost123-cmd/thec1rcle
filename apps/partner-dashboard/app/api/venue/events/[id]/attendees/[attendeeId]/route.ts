import { NextRequest, NextResponse } from "next/server";
import { requireVenueAccess } from "@/lib/rbac/staffProfileEnforcer";
import { getAdminDb } from "@/lib/firebase/admin";
import {
    attendeeMatchesOrder,
    buildOrderNumber,
    getOrderEmail,
    getOrderPhone,
    normalizeOrderRecord,
    normalizeValue,
    toIso,
} from "@/lib/server/orderTracking";

function maskEmail(email: string, allow: boolean) {
    if (allow || !email) return email;
    const [local, domain] = email.split("@");
    return domain ? `${local.slice(0, 2)}***@${domain}` : email;
}

function maskPhone(phone: string, allow: boolean) {
    if (allow || !phone) return phone;
    return phone.length > 4 ? `${"*".repeat(phone.length - 4)}${phone.slice(-4)}` : "****";
}

function maskName(name: string, allow: boolean) {
    if (allow || !name) return name;
    const parts = name.trim().split(" ");
    if (parts.length <= 1) return name;
    return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
}

function buildTimeline(params: {
    attendee: any;
    orders: ReturnType<typeof normalizeOrderRecord>[];
    userCreatedAt?: string | null;
}) {
    const entries: Array<{
        id: string;
        label: string;
        timestamp: string | null;
        kind: string;
    }> = [];

    if (params.userCreatedAt) {
        entries.push({
            id: "joined-platform",
            label: `${params.attendee.fullName} joined THE C1RCLE.`,
            timestamp: params.userCreatedAt,
            kind: "joined",
        });
    }

    if (params.attendee.purchasedAt) {
        entries.push({
            id: "attendee-created",
            label: `${params.attendee.fullName} was added to this event.`,
            timestamp: params.attendee.purchasedAt,
            kind: "event_joined",
        });
    }

    for (const order of params.orders) {
        entries.push({
            id: `${order.id}-created`,
            label: `${params.attendee.fullName} placed ${order.orderNumber} for ₹${order.amount.toFixed(2)}.`,
            timestamp: order.createdAt,
            kind: "order_created",
        });

        if (order.checkedInAt) {
            entries.push({
                id: `${order.id}-checked-in`,
                label: `${params.attendee.fullName} checked in for ${order.eventName}.`,
                timestamp: order.checkedInAt,
                kind: "checked_in",
            });
        }

        if (order.cancelledAt) {
            entries.push({
                id: `${order.id}-cancelled`,
                label: `${order.orderNumber} was cancelled.`,
                timestamp: order.cancelledAt,
                kind: "cancelled",
            });
        }

        for (const opsEntry of order.opsLog) {
            const actionLabel =
                opsEntry.type === "receipt_resent"
                    ? `Receipt re-sent for ${order.orderNumber}.`
                    : opsEntry.type === "order_cancelled"
                        ? `${order.orderNumber} was ${opsEntry.mode === "cancel_and_relist" ? "cancelled and relisted" : "cancelled"}.`
                        : `${order.orderNumber} was updated.`;

            entries.push({
                id: opsEntry.id,
                label: actionLabel,
                timestamp: opsEntry.createdAt,
                kind: opsEntry.type,
            });
        }
    }

    return entries.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; attendeeId: string }> }
) {
    const { id: eventId, attendeeId } = await params;
    const ctx = await requireVenueAccess(request, "guestlist:read");
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    try {
        const db = getAdminDb();
        const eventDoc = await db.collection("events").doc(eventId).get();
        if (!eventDoc.exists) return NextResponse.json({ error: "Event not found" }, { status: 404 });

        const eventData = eventDoc.data() || {};
        if (eventData.venueId !== ctx.venueId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const [ordersSnap, rsvpSnap, guestlistSnap] = await Promise.all([
            db.collection("orders").where("eventId", "==", eventId).get(),
            db.collection("rsvp_orders").where("eventId", "==", eventId).get(),
            db.collection("guest_lists").where("eventId", "==", eventId).get(),
        ]);

        const eventAttendees = [
            ...ordersSnap.docs.map((doc) => {
                const order = doc.data();
                return {
                    id: doc.id,
                    attendeeId: String(order.userId || order.buyerId || doc.id),
                    fullName: order.buyerName || order.displayName || order.userName || "Guest",
                    email: getOrderEmail(order),
                    phone: getOrderPhone(order),
                    instagram: order.instagram || order.instagramHandle || "",
                    source: "ticket",
                    status: order.status === "refunded" ? "refunded" : (order.checkedIn || order.scanned || order.status === "checked_in") ? "checked_in" : "registered",
                    purchasedAt: toIso(order.createdAt),
                    checkedInAt: toIso(order.checkedInAt || order.scannedAt),
                    tags: order.tags || [],
                    totalSpend: Number(order.totalAmount || 0),
                    quantity: Array.isArray(order.tickets) ? order.tickets.reduce((sum: number, ticket: any) => sum + Number(ticket?.quantity || 1), 0) : Number(order.quantity || 1),
                    orderId: doc.id,
                    ticketTier: order.tierName || order.ticketTypeName || order.tickets?.[0]?.name || "General",
                    city: order.city || "",
                    area: order.area || order.locality || "",
                    isVip: Boolean(order.isVip),
                    orderNumber: buildOrderNumber(order, doc.id),
                };
            }),
            ...rsvpSnap.docs.map((doc) => {
                const order = doc.data();
                return {
                    id: doc.id,
                    attendeeId: String(order.userId || doc.id),
                    fullName: order.userName || order.displayName || "Guest",
                    email: getOrderEmail(order),
                    phone: getOrderPhone(order),
                    instagram: order.instagram || order.instagramHandle || "",
                    source: "rsvp",
                    status: order.checkedIn || order.scanned || order.status === "checked_in" ? "checked_in" : "registered",
                    purchasedAt: toIso(order.createdAt),
                    checkedInAt: toIso(order.checkedInAt || order.scannedAt),
                    tags: order.tags || [],
                    totalSpend: Number(order.totalAmount || 0),
                    quantity: Array.isArray(order.tickets) ? order.tickets.reduce((sum: number, ticket: any) => sum + Number(ticket?.quantity || 1), 0) : Number(order.quantity || 1),
                    orderId: doc.id,
                    ticketTier: order.tierName || order.ticketTypeName || "RSVP",
                    city: order.city || "",
                    area: order.area || order.locality || "",
                    isVip: Boolean(order.isVip),
                    orderNumber: buildOrderNumber(order, doc.id),
                };
            }),
            ...guestlistSnap.docs.map((doc) => {
                const guest = doc.data();
                return {
                    id: doc.id,
                    attendeeId: String(guest.userId || doc.id),
                    fullName: guest.displayName || guest.name || "Guest",
                    email: String(guest.email || ""),
                    phone: String(guest.phone || ""),
                    instagram: guest.instagram || guest.instagramHandle || "",
                    source: guest.source || "manual",
                    status: guest.checkedIn ? "checked_in" : guest.approved === false ? "denied" : guest.requiresApproval ? "pending_approval" : "registered",
                    purchasedAt: toIso(guest.addedAt),
                    checkedInAt: toIso(guest.checkedInAt),
                    tags: guest.tags || [],
                    totalSpend: Number(guest.totalSpend || 0),
                    quantity: 1,
                    orderId: guest.orderId || "",
                    ticketTier: guest.tierName || (guest.isVip ? "VIP Guestlist" : "Guestlist"),
                    city: guest.city || "",
                    area: guest.area || guest.locality || "",
                    isVip: Boolean(guest.isVip),
                    orderNumber: guest.orderId ? buildOrderNumber({ orderIndex: guest.orderIndex }, guest.orderId) : null,
                };
            }),
        ];

        const attendee = eventAttendees.find((entry) => entry.attendeeId === attendeeId || entry.id === attendeeId);
        if (!attendee) {
            return NextResponse.json({ error: "Attendee not found" }, { status: 404 });
        }

        const identity = {
            attendeeId: attendee.attendeeId,
            email: attendee.email,
            phone: attendee.phone,
        };

        const orderQueries: Promise<FirebaseFirestore.QuerySnapshot>[] = [];
        const normalizedEmail = normalizeValue(attendee.email);
        if (attendee.attendeeId && attendee.attendeeId !== attendee.id) {
            orderQueries.push(db.collection("orders").where("userId", "==", attendee.attendeeId).where("venueId", "==", ctx.venueId).get());
            orderQueries.push(db.collection("rsvp_orders").where("userId", "==", attendee.attendeeId).where("venueId", "==", ctx.venueId).get());
        }
        if (normalizedEmail) {
            orderQueries.push(db.collection("orders").where("userEmail", "==", attendee.email).where("venueId", "==", ctx.venueId).get());
            orderQueries.push(db.collection("rsvp_orders").where("userEmail", "==", attendee.email).where("venueId", "==", ctx.venueId).get());
        }

        const orderSnapshots = await Promise.all(orderQueries);
        const matchedDocs = new Map<string, { doc: FirebaseFirestore.QueryDocumentSnapshot; source: "ticket" | "rsvp" }>();

        for (const doc of ordersSnap.docs) matchedDocs.set(doc.id, { doc, source: "ticket" });
        for (const snapshot of orderSnapshots) {
            for (const doc of snapshot.docs) {
                const source = doc.ref.parent.id === "rsvp_orders" ? "rsvp" : "ticket";
                matchedDocs.set(doc.id, { doc, source });
            }
        }

        const orders = Array.from(matchedDocs.values())
            .map(({ doc, source }) => normalizeOrderRecord(doc, source))
            .filter((order) => attendeeMatchesOrder(order as any, identity) || order.id === attendee.orderId)
            .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

        const userDoc = attendee.attendeeId && attendee.attendeeId !== attendee.id
            ? await db.collection("users").doc(attendee.attendeeId).get().catch(() => null)
            : null;
        const userCreatedAt = userDoc?.exists ? toIso(userDoc.data()?.createdAt || userDoc.data()?.joinedAt) : null;

        const uniqueEvents = new Set(orders.map((order) => order.eventId).filter(Boolean));
        if (attendee.orderId && attendee.source !== "ticket") uniqueEvents.add(eventId);

        const lifetimeSpend = orders.reduce((sum, order) => sum + Number(order.amount || 0), 0);
        const timeline = buildTimeline({ attendee, orders, userCreatedAt });

        const maskedAttendee = {
            ...attendee,
            fullName: maskName(attendee.fullName, ctx.piiPolicy.showLastName),
            email: maskEmail(attendee.email, ctx.piiPolicy.showEmail),
            phone: maskPhone(attendee.phone, ctx.piiPolicy.showPhone),
            stats: {
                eventsAttended: uniqueEvents.size || 1,
                lifetimeSpend: ctx.piiPolicy.showOrderAmount ? lifetimeSpend : 0,
            },
            joinedAt: userCreatedAt,
        };

        return NextResponse.json({
            attendee: maskedAttendee,
            orders: orders.map((order) => ({
                ...order,
                customerName: maskName(order.customerName, ctx.piiPolicy.showLastName),
                email: maskEmail(order.email, ctx.piiPolicy.showEmail),
                phone: maskPhone(order.phone, ctx.piiPolicy.showPhone),
                amount: ctx.piiPolicy.showOrderAmount ? order.amount : 0,
                items: ctx.piiPolicy.showOrderAmount
                    ? order.items
                    : order.items.map((item) => ({ ...item, price: 0 })),
            })),
            timeline,
            selectedOrderId: orders[0]?.id || attendee.orderId || null,
        });
    } catch (error: any) {
        console.error("[venue/events/[id]/attendees/[attendeeId]]", error?.message || error);
        return NextResponse.json({ error: "Failed to fetch attendee profile" }, { status: 500 });
    }
}
