import { NextResponse } from "next/server";
import { requireVenueAccess, applyPIIMask } from "@/lib/rbac/staffProfileEnforcer";
import { getAdminDb, isFirebaseConfigured } from "@/lib/firebase/admin";
import { buildOrderNumber, getOrderAmount, getTicketsCount } from "@/lib/server/orderTracking";

interface VenueOrderRow {
    id: string;
    orderNumber: string;
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

export async function GET(request: Request) {
    const ctx = await requireVenueAccess(request, "guestlist:read");
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    if (!isFirebaseConfigured()) {
        console.error("[venue/orders] Firebase configuration missing in production context");
        return NextResponse.json({ error: "System configuration error" }, { status: 500 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
        const cursorId = searchParams.get("cursor") || null;
        const eventIdFilter = searchParams.get("eventId") || null;
        
        const { venueId, piiPolicy } = ctx;
        const db = getAdminDb();

        // 1. Build Base Query - Paginated at the DB level
        let query = db.collection("orders")
            .where("venueId", "==", venueId)
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
        
        // 2. Fetch related RSVP orders if this is the first page and not filtered by event
        // PRO NOTE: In a high-scale system, RSVPs and Tickets should ideally live in one 
        // searchable read-model. For now, we fetch them in parallel if no specific event filter is set.
        let rsvpDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [];
        if (!cursorId && !eventIdFilter) {
            const rsvpSnap = await db.collection("rsvp_orders")
                .where("venueId", "==", venueId)
                .orderBy("createdAt", "desc")
                .limit(limit)
                .get();
            rsvpDocs = rsvpSnap.docs;
        }

        let orderDocs = snapshot.docs.map(doc => ({ source: "ticket" as const, doc }));

        // Legacy/test fallback: some older orders are missing venueId but still belong
        // to venue-owned events. Recover those rows for the first page so the overview
        // doesn't look empty during local verification.
        if (!cursorId && orderDocs.length === 0) {
            const venueEventsSnap = await db.collection("events")
                .where("venueId", "==", venueId)
                .limit(20)
                .get();

            const eventIds = venueEventsSnap.docs.map((doc) => doc.id).filter(Boolean);
            const recovered: Array<{ source: "ticket"; doc: FirebaseFirestore.QueryDocumentSnapshot }> = [];

            for (let i = 0; i < eventIds.length; i += 10) {
                const chunk = eventIds.slice(i, i + 10);
                if (chunk.length === 0) continue;
                const recoveredSnap = await db.collection("orders")
                    .where("eventId", "in", chunk)
                    .orderBy("createdAt", "desc")
                    .limit(limit)
                    .get();

                recovered.push(...recoveredSnap.docs.map((doc) => ({ source: "ticket" as const, doc })));
            }

            const seenIds = new Set<string>();
            orderDocs = recovered.filter(({ doc }) => {
                if (seenIds.has(doc.id)) return false;
                seenIds.add(doc.id);
                return true;
            });
        }

        // 3. Process into uniform rows
        const allDocs = [...orderDocs, 
                         ...rsvpDocs.map(doc => ({ source: "rsvp" as const, doc }))]
            .sort((a, b) => {
                const aTime = new Date(a.doc.data().createdAt || 0).getTime();
                const bTime = new Date(b.doc.data().createdAt || 0).getTime();
                return bTime - aTime;
            })
            .slice(0, limit);

        const orders: VenueOrderRow[] = allDocs.map(({ source, doc }) => {
            const data = doc.data();
            return {
                id: doc.id,
                orderNumber: buildOrderNumber(data, doc.id),
                customerName: data.customerName || data.userName || data.buyerName || "C1RCLE Guest",
                email: data.customerEmail || data.userEmail || "",
                phone: data.customerPhone || data.userPhone || "",
                eventId: data.eventId || "",
                eventName: data.eventName || data.eventTitle || "Upcoming Event",
                amount: getOrderAmount(data),
                ticketsCount: getTicketsCount(data),
                createdAt: data.createdAt || new Date().toISOString(),
                status: data.status || "confirmed",
                source,
            };
        });

        // 4. Centralized PII Masking applied at the response layer
        const maskedOrders = applyPIIMask(orders, piiPolicy);

        const lastVisible = snapshot.docs[snapshot.docs.length - 1]?.id || null;

        return NextResponse.json({
            orders: maskedOrders,
            pagination: {
                limit,
                nextCursor: lastVisible,
                hasMore: snapshot.docs.length === limit,
            }
        }, {
            headers: { "Cache-Control": "private, no-store" }
        });

    } catch (error: any) {
        console.error("[venue/orders] Production Failure:", error?.message || error);
        return NextResponse.json({ error: "Failed to load venue data" }, { status: 500 });
    }
}
