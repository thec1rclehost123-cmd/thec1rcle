import { NextResponse } from "next/server";
import { requireHostAccess } from "@/lib/server/hostAuthMiddleware";
import { getAdminDb, isFirebaseConfigured } from "@/lib/firebase/admin";
import { buildOrderNumber, getOrderAmount, getTicketsCount } from "@/lib/server/orderTracking";

interface HostOrderRow {
    id: string;
    orderNumber: string;
    orderId: string;
    attendeeId: string;
    customerName: string;
    email: string;
    phone: string;
    eventId: string;
    eventName: string;
    amount: number;
    ticketsCount: number;
    createdAt: string;
    status: string;
    source: "ticket" | "rsvp";
}

function maskEmail(email: string, allow: boolean) {
    if (allow || !email) return email;
    const [local, domain] = email.split("@");
    return domain ? `${local.slice(0, 1)}***@${domain}` : email;
}

function maskPhone(phone: string, allow: boolean) {
    if (allow || !phone) return phone;
    const digits = phone.replace(/\s+/g, "");
    if (digits.length <= 4) return "****";
    return `${digits.slice(0, 2)}${"*".repeat(Math.max(digits.length - 4, 2))}${digits.slice(-2)}`;
}

export async function GET(request: Request) {
    const analyticsCtx = await requireHostAccess(request as any, "VIEW_ANALYTICS");
    const guestlistCtx = "error" in analyticsCtx
        ? await requireHostAccess(request as any, "VIEW_GUESTLIST")
        : analyticsCtx;
    if ("error" in guestlistCtx) {
        return NextResponse.json({ error: guestlistCtx.error }, { status: guestlistCtx.status });
    }

    if (!isFirebaseConfigured()) {
        return NextResponse.json({ error: "System configuration error" }, { status: 500 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
        const cursorId = searchParams.get("cursor") || null;
        const eventIdFilter = searchParams.get("eventId") || null;
        const { hostId, piiPolicy } = guestlistCtx;
        const db = getAdminDb();

        let query = db.collection("orders")
            .where("hostId", "==", hostId)
            .orderBy("createdAt", "desc");

        if (eventIdFilter) {
            query = query.where("eventId", "==", eventIdFilter);
        }

        if (cursorId) {
            const cursorDoc = await db.collection("orders").doc(cursorId).get();
            if (cursorDoc.exists) {
                query = query.startAfter(cursorDoc);
            }
        }

        const snapshot = await query.limit(limit).get();

        let rsvpDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
        if (!cursorId && !eventIdFilter) {
            const rsvpSnap = await db.collection("rsvp_orders")
                .where("hostId", "==", hostId)
                .orderBy("createdAt", "desc")
                .limit(limit)
                .get();
            rsvpDocs = rsvpSnap.docs;
        }

        const allDocs = [
            ...snapshot.docs.map((doc) => ({ source: "ticket" as const, doc })),
            ...rsvpDocs.map((doc) => ({ source: "rsvp" as const, doc })),
        ]
            .sort((a, b) => {
                const aTime = new Date(a.doc.data().createdAt || 0).getTime();
                const bTime = new Date(b.doc.data().createdAt || 0).getTime();
                return bTime - aTime;
            })
            .slice(0, limit);

        const orders: HostOrderRow[] = allDocs.map(({ source, doc }) => {
            const data = doc.data();
            return {
                id: doc.id,
                orderNumber: buildOrderNumber(data, doc.id),
                orderId: doc.id,
                attendeeId: String(data.userId || data.attendeeId || data.buyerId || ""),
                customerName: data.customerName || data.userName || data.buyerName || "C1RCLE Guest",
                email: maskEmail(data.customerEmail || data.userEmail || "", piiPolicy.showEmail),
                phone: maskPhone(data.customerPhone || data.userPhone || "", piiPolicy.showPhone),
                eventId: data.eventId || "",
                eventName: data.eventName || data.eventTitle || "Upcoming Event",
                amount: getOrderAmount(data),
                ticketsCount: getTicketsCount(data),
                createdAt: data.createdAt || new Date().toISOString(),
                status: data.status || "confirmed",
                source,
            };
        });

        const lastVisible = snapshot.docs[snapshot.docs.length - 1]?.id || null;

        return NextResponse.json({
            orders,
            pagination: {
                limit,
                nextCursor: lastVisible,
                hasMore: snapshot.docs.length === limit,
            },
        }, {
            headers: { "Cache-Control": "private, no-store" },
        });
    } catch (error: any) {
        console.error("[host/orders] Failure:", error?.message || error);
        return NextResponse.json({ error: "Failed to load host orders" }, { status: 500 });
    }
}
