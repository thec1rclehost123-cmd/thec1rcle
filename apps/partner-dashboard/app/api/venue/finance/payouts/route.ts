import { NextRequest, NextResponse } from "next/server";
import { requireVenueAccess } from "@/lib/rbac/staffProfileEnforcer";
import { getAdminDb } from "@/lib/firebase/admin";
import { logger } from "@/lib/server/logger";

type VenuePayout = {
    id: string;
    arrivalDate: string | null;
    amount: number;
    currency: string;
    status: "paid" | "in_transit" | "failed";
    description: string | null;
    bankLast4: string | null;
    eventId: string | null;
    eventName: string | null;
    eventDate: string | null;
};

const COMPLETED_ORDER_STATUSES = ["completed", "confirmed", "checked_in"];

export async function GET(request: NextRequest) {
    const ctx = await requireVenueAccess(request, "finance:read_payouts");
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const { searchParams } = new URL(request.url);
    const limit = Math.min(25, Math.max(1, Number(searchParams.get("limit") || 10)));
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const offset = (page - 1) * limit;
    const { venueId } = ctx;

    try {
        const db = getAdminDb();

        const eventsSnap = await db.collection("events").where("venueId", "==", venueId).limit(80).get();
        const events = eventsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Array<Record<string, any> & { id: string }>;

        const payouts = (
            await Promise.all(
                events.map(async (event) => {
                    const [completedSnap, refundedSnap] = await Promise.all([
                        db.collection("orders")
                            .where("eventId", "==", event.id)
                            .where("status", "in", COMPLETED_ORDER_STATUSES)
                            .get(),
                        db.collection("orders")
                            .where("eventId", "==", event.id)
                            .where("status", "==", "refunded")
                            .get(),
                    ]);

                    const gross = completedSnap.docs.reduce((sum, doc) => sum + Number(doc.data()?.totalAmount || doc.data()?.amount || 0), 0);
                    const refunds = refundedSnap.docs.reduce((sum, doc) => sum + Number(doc.data()?.totalAmount || doc.data()?.amount || 0), 0);
                    const netSales = Math.max(gross - refunds, 0);
                    if (netSales <= 0) return null;

                    const platformFee = Math.round(netSales * 0.1);
                    const venueCommissionRate = Number(event.venueCommissionRate || 0.15);
                    const isHostEvent = Boolean(event.hostId || event.creatorRole === "host");
                    const venueNet = isHostEvent
                        ? Math.max(Math.round(netSales * venueCommissionRate), 0)
                        : Math.max(netSales - platformFee, 0);

                    return {
                        id: `venue-event-${event.id}`,
                        arrivalDate: toIso(event.settledAt || event.endDate || event.startDate || event.date || event.updatedAt || event.createdAt),
                        amount: venueNet,
                        currency: "INR",
                        status: normalizeStatus(event.settlementStatus || event.lifecycle),
                        description: isHostEvent ? "Venue share from hosted event" : "Venue net ticket revenue",
                        bankLast4: null,
                        eventId: event.id,
                        eventName: String(event.name || event.title || "Untitled Event"),
                        eventDate: toIso(event.startDate || event.date || event.endDate || null),
                    } satisfies VenuePayout;
                })
            )
        )
            .filter(Boolean)
            .sort((a, b) => {
                const aTime = a?.arrivalDate ? new Date(a.arrivalDate).getTime() : 0;
                const bTime = b?.arrivalDate ? new Date(b.arrivalDate).getTime() : 0;
                return bTime - aTime;
            }) as VenuePayout[];

        const sliced = payouts.slice(offset, offset + limit);
        const hasMore = payouts.length > offset + limit;

        return NextResponse.json(
            {
                payouts: sliced,
                nextCursor: hasMore ? sliced[sliced.length - 1]?.id ?? null : null,
                hasMore,
            },
            { headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=120" } }
        );
    } catch (err: any) {
        logger.error("venue/finance/payouts", "GET failed", { error: err.message });
        return NextResponse.json({ error: "Failed to load payouts" }, { status: 500 });
    }
}

function normalizeStatus(status: unknown): "paid" | "in_transit" | "failed" {
    switch (String(status || "").toLowerCase()) {
        case "settled":
        case "paid":
        case "completed":
            return "paid";
        case "blocked":
        case "failed":
        case "cancelled":
            return "failed";
        default:
            return "in_transit";
    }
}

function toIso(value: unknown) {
    if (!value) return null;
    if (typeof value === "string") {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    }
    if (value && typeof value === "object" && "toDate" in (value as Record<string, unknown>)) {
        const converted = (value as { toDate?: () => Date }).toDate?.();
        return converted ? converted.toISOString() : null;
    }
    return null;
}
