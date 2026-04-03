import { NextRequest, NextResponse } from "next/server";
import { requireVenueAccess } from "@/lib/rbac/staffProfileEnforcer";
import { getAdminDb } from "@/lib/firebase/admin";
import { addDays, addMonths, startOfDay, startOfMonth } from "date-fns";
import { getOrderAmount, getTicketsCount } from "@/lib/server/orderTracking";

function formatRangeLabel(date: Date, range: string) {
    if (range === "1d") {
        return date.toLocaleTimeString("en-US", {
            hour: "numeric",
            hour12: true,
        });
    }

    if (range === "all") {
        return date.toLocaleDateString("en-US", {
            month: "short",
            year: "2-digit",
        });
    }

    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
    });
}

function toDate(value: any): Date | null {
    if (!value) return null;
    if (typeof value?.toDate === "function") {
        const date = value.toDate();
        return Number.isNaN(date?.getTime?.()) ? null : date;
    }
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function pad(value: number) {
    return String(value).padStart(2, "0");
}

function getDayKey(date: Date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function getHourKey(date: Date) {
    return `${getDayKey(date)}T${pad(date.getHours())}:00`;
}

function getMonthKey(date: Date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

function resolveOrderDate(order: Record<string, any>) {
    return (
        toDate(order.createdAt) ||
        toDate(order.confirmedAt) ||
        toDate(order.checkedInAt || order.scannedAt) ||
        toDate(order.updatedAt) ||
        toDate(order.paymentDetails?.paidAt) ||
        toDate(order.paidAt) ||
        null
    );
}

function shouldIncludeOrder(order: Record<string, any>) {
    const status = String(order.status || "").trim().toLowerCase();
    if (!status) return true;
    return !["cancelled", "canceled", "refunded", "failed", "voided", "expired"].includes(status);
}

function getOrderUnits(order: Record<string, any>, source: "ticket" | "rsvp") {
    if (source === "rsvp") {
        const quantity = Number(order.quantity ?? order.ticketsCount ?? order.guestsCount ?? 1);
        return Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
    }

    const ticketsCount = getTicketsCount(order);
    return Number.isFinite(ticketsCount) && ticketsCount > 0 ? ticketsCount : 1;
}

function getOrderRevenue(order: Record<string, any>) {
    const rawRevenue = Number(getOrderAmount(order) || 0);
    if (!Number.isFinite(rawRevenue)) return 0;
    return rawRevenue > 1000 ? rawRevenue / 100 : rawRevenue;
}

/**
 * GET /api/venue/analytics/time-series?venueId=&range=1d|1w|1m|all&metric=tickets|revenue
 *
 * Returns live cross-event venue performance series.
 *
 * We intentionally derive this from raw confirmed orders/rsvps for the overview
 * surface so the graph reflects live numbers even when aggregation backfills lag.
 */
export async function GET(req: NextRequest) {
    const venueCtx = await requireVenueAccess(req, "analytics:read");
    if ("error" in venueCtx) {
        return NextResponse.json({ error: venueCtx.error }, { status: venueCtx.status });
    }

    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "1m";

    try {
        const venueId = venueCtx.venueId;
        const metric  = searchParams.get("metric") || "tickets";

        const db  = getAdminDb();
        const now = new Date();
        const { buckets } = buildBuckets(range, now);

        const series = await buildSeriesFromRawOrders({ db, venueId, buckets, range, metric, now });

        const total = series.reduce((s, p) => s + p.value, 0);

        return NextResponse.json({ series, total }, {
            headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
        });

    } catch (err: any) {
        console.error("[AnalyticsTimeSeries] Error:", err.message);
        const { buckets } = buildBuckets(range, new Date());
        const series = buckets.map((bucket) => ({
            label: bucket.label,
            date: bucket.dateKey,
            value: 0,
        }));
        return NextResponse.json({ series, total: 0 }, {
            headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
        });
    }
}

async function buildSeriesFromRawOrders({
    db,
    venueId,
    buckets,
    range,
    metric,
    now,
}: {
    db: FirebaseFirestore.Firestore;
    venueId: string;
    buckets: Bucket[];
    range: string;
    metric: string;
    now: Date;
}) {
    const startDate = getRangeStart(range, now);
    const [ordersSnap, rsvpSnap] = await Promise.all([
        db.collection("orders")
            .where("venueId", "==", venueId)
            .get(),
        db.collection("rsvp_orders")
            .where("venueId", "==", venueId)
            .get(),
    ]);

    const bucketValues = new Map<string, number>(buckets.map((bucket) => [bucket.dateKey, 0]));

    const applyOrderToBucket = (order: Record<string, any>, source: "ticket" | "rsvp") => {
        if (!shouldIncludeOrder(order)) return;

        const orderDate = resolveOrderDate(order);
        if (!orderDate) return;
        if (orderDate < startDate) return;

        const bucketKey = getBucketKey(orderDate, range);

        if (!bucketValues.has(bucketKey)) return;

        const quantity = getOrderUnits(order, source);
        const revenue = getOrderRevenue(order);

        bucketValues.set(
            bucketKey,
            (bucketValues.get(bucketKey) || 0) + (metric === "revenue" ? revenue : quantity)
        );
    };

    const orderDocs = ordersSnap.docs;
    const rsvpDocs = rsvpSnap.docs;

    const seenOrderIds = new Set<string>();
    for (const doc of orderDocs) {
        if (seenOrderIds.has(doc.id)) continue;
        seenOrderIds.add(doc.id);
        const order = doc.data();
        applyOrderToBucket(order, "ticket");
    }

    const seenRsvpIds = new Set<string>();
    for (const doc of rsvpDocs) {
        if (seenRsvpIds.has(doc.id)) continue;
        seenRsvpIds.add(doc.id);
        const order = doc.data();
        applyOrderToBucket(order, "rsvp");
    }

    return buckets.map((bucket) => ({
        label: bucket.label,
        date: bucket.dateKey,
        value: bucketValues.get(bucket.dateKey) || 0,
    }));
}

// ── Bucket builders ───────────────────────────────────────────────────────────

function buildBuckets(range: string, now: Date): { buckets: Bucket[]; startDateStr: string } {
    if (range === "1d") {
        const start = getRangeStart("1d", now);
        const buckets: Bucket[] = Array.from({ length: 24 }, (_, index) => {
            const d = new Date(start);
            d.setHours(start.getHours() + index, 0, 0, 0);
            return {
                dateKey: getHourKey(d),
                label: formatRangeLabel(d, "1d"),
            };
        });
        const startDateStr = getDayKey(start);
        return { buckets, startDateStr };
    }

    if (range === "1w") {
        const firstDay = startOfDay(addDays(now, -6));
        const startDateStr = getDayKey(firstDay);
        const buckets: Bucket[] = Array.from({ length: 7 }, (_, i) => {
            const d = addDays(firstDay, i);
            return {
                dateKey: getDayKey(d),
                label:   d.toLocaleDateString("en-IN", { weekday: "short" }),
            };
        });
        return { buckets, startDateStr };
    }

    if (range === "1m") {
        const firstDay = startOfDay(addDays(now, -29));
        const startDateStr = getDayKey(firstDay);
        const buckets: Bucket[] = Array.from({ length: 30 }, (_, i) => {
            const d = addDays(firstDay, i);
            return {
                dateKey: getDayKey(d),
                label:   d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
            };
        });
        return { buckets, startDateStr };
    }

    // "all" — last 12 months, one bucket per month
    const firstMonth = startOfMonth(addMonths(now, -11));
    const startDateStr = getDayKey(firstMonth);
    const buckets: Bucket[] = Array.from({ length: 12 }, (_, i) => {
        const d = addMonths(firstMonth, i);
        return {
            dateKey: getMonthKey(d),
            label:   d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
        };
    });
    return { buckets, startDateStr };
}

interface Bucket {
    dateKey: string;
    label:   string;
}

function getRangeStart(range: string, now: Date): Date {
    if (range === "all") {
        return startOfMonth(addMonths(now, -11));
    }

    if (range === "1m") {
        return startOfDay(addDays(now, -29));
    }

    if (range === "1w") {
        return startOfDay(addDays(now, -6));
    }

    const start = new Date(now);
    start.setMinutes(0, 0, 0);
    start.setHours(start.getHours() - 23);
    return start;
}

function getBucketKey(date: Date, range: string): string {
    if (range === "all") {
        return getMonthKey(date);
    }

    if (range === "1d") {
        return getHourKey(date);
    }

    return getDayKey(date);
}
