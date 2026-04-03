import { NextRequest, NextResponse } from "next/server";
import { requireHostAccess } from "@/lib/server/hostAuthMiddleware";
import { getAdminDb } from "@/lib/firebase/admin";
import { logger } from "@/lib/server/logger";

type HostFinancePayout = {
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

export async function GET(request: NextRequest) {
    const ctx = await requireHostAccess(request, "VIEW_FINANCIALS");
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const { searchParams } = new URL(request.url);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit") || 20)));
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const offset = (page - 1) * limit;
    const { hostId } = ctx;

    try {
        const db = getAdminDb();

        const settlementsSnap = await db
            .collection("partner_settlements")
            .where("partnerType", "==", "host")
            .where("partnerId", "==", hostId)
            .limit(100)
            .get();

        const eventIds = Array.from(
            new Set(
                settlementsSnap.docs
                    .map((doc) => String(doc.data()?.eventId || ""))
                    .filter(Boolean)
            )
        ) as string[];

        const eventMap = new Map<string, any>();
        await Promise.all(
            eventIds.map(async (eventId) => {
                const eventDoc = await db.collection("events").doc(eventId).get();
                if (eventDoc.exists) eventMap.set(eventId, eventDoc.data());
            })
        );

        let payouts: HostFinancePayout[] = settlementsSnap.docs.map((doc) => {
            const data = doc.data();
            const eventId = String(data.eventId || "") || null;
            const event = eventId ? eventMap.get(eventId) : null;
            const status = normalizeStatus(data.status);

            return {
                id: doc.id,
                arrivalDate: toIso(data.settledAt || data.eventDate || event?.endDate || event?.startDate || data.createdAt),
                amount: Number(data.netPaise || 0) / 100,
                currency: data.currency || "INR",
                status,
                description: data.holdReason || null,
                bankLast4: data.bankLast4 || null,
                eventId,
                eventName: data.eventName || event?.name || event?.title || null,
                eventDate: toIso(data.eventDate || event?.startDate || event?.date || null),
            };
        });

        payouts.sort((a, b) => {
            const aTime = a.arrivalDate ? new Date(a.arrivalDate).getTime() : 0;
            const bTime = b.arrivalDate ? new Date(b.arrivalDate).getTime() : 0;
            return bTime - aTime;
        });

        if (payouts.length === 0) {
            const legacySnap = await db
                .collection("host_payouts")
                .where("hostId", "==", hostId)
                .limit(100)
                .get();

            payouts = legacySnap.docs.map((doc) => {
                const data = doc.data();
                return {
                    id: doc.id,
                    arrivalDate: toIso(data.arrivalDate),
                    amount: Number(data.amount || 0),
                    currency: data.currency || "INR",
                    status: normalizeStatus(data.status),
                    description: data.description || null,
                    bankLast4: data.bankLast4 || null,
                    eventId: data.eventId || null,
                    eventName: data.eventName || null,
                    eventDate: toIso(data.eventDate || null),
                };
            }).sort((a, b) => {
                const aTime = a.arrivalDate ? new Date(a.arrivalDate).getTime() : 0;
                const bTime = b.arrivalDate ? new Date(b.arrivalDate).getTime() : 0;
                return bTime - aTime;
            });
        }

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
        logger.error("host/finance/payouts", "GET failed", { error: err.message });
        return NextResponse.json({ error: "Failed to load payouts" }, { status: 500 });
    }
}

function normalizeStatus(status: unknown): "paid" | "in_transit" | "failed" {
    switch (String(status || "").toLowerCase()) {
        case "settled":
        case "completed":
        case "paid":
            return "paid";
        case "failed":
        case "disputed":
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
