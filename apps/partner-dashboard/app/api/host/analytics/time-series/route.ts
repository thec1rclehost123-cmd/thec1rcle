import { NextRequest, NextResponse } from "next/server";
import { requireHostAccess } from "@/lib/server/hostAuthMiddleware";
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

export async function GET(req: NextRequest) {
    const hostCtx = await requireHostAccess(req, "VIEW_ANALYTICS");
    if ("error" in hostCtx) {
        return NextResponse.json({ error: hostCtx.error }, { status: hostCtx.status });
    }

    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "1m";

    try {
        const hostId = hostCtx.hostId;
        const metric = searchParams.get("metric") || "tickets";
        const db = getAdminDb();
        const now = new Date();
        const { buckets } = buildBuckets(range, now);
        const series = await buildSeriesFromRawOrders({ db, hostId, buckets, range, metric, now });
        const total = series.reduce((sum, point) => sum + point.value, 0);

        return NextResponse.json({ series, total }, {
            headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=60" },
        });
    } catch (err: any) {
        console.error("[HostAnalyticsTimeSeries] Error:", err.message);
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
    hostId,
    buckets,
    range,
    metric,
    now,
}: {
    db: FirebaseFirestore.Firestore;
    hostId: string;
    buckets: Bucket[];
    range: string;
    metric: string;
    now: Date;
}) {
    const startDate = getRangeStart(range, now);
    const [ordersSnap, rsvpSnap] = await Promise.all([
        db.collection("orders")
            .where("hostId", "==", hostId)
            .get(),
        db.collection("rsvp_orders")
            .where("hostId", "==", hostId)
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

    const seenOrderIds = new Set<string>();
    for (const doc of ordersSnap.docs) {
        if (seenOrderIds.has(doc.id)) continue;
        seenOrderIds.add(doc.id);
        applyOrderToBucket(doc.data(), "ticket");
    }

    const seenRsvpIds = new Set<string>();
    for (const doc of rsvpSnap.docs) {
        if (seenRsvpIds.has(doc.id)) continue;
        seenRsvpIds.add(doc.id);
        applyOrderToBucket(doc.data(), "rsvp");
    }

    return buckets.map((bucket) => ({
        label: bucket.label,
        date: bucket.dateKey,
        value: bucketValues.get(bucket.dateKey) || 0,
    }));
}

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
        return { buckets, startDateStr: getDayKey(start) };
    }

    if (range === "1w") {
        const firstDay = startOfDay(addDays(now, -6));
        const buckets: Bucket[] = Array.from({ length: 7 }, (_, i) => {
            const d = addDays(firstDay, i);
            return {
                dateKey: getDayKey(d),
                label: d.toLocaleDateString("en-IN", { weekday: "short" }),
            };
        });
        return { buckets, startDateStr: getDayKey(firstDay) };
    }

    if (range === "1m") {
        const firstDay = startOfDay(addDays(now, -29));
        const buckets: Bucket[] = Array.from({ length: 30 }, (_, i) => {
            const d = addDays(firstDay, i);
            return {
                dateKey: getDayKey(d),
                label: d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
            };
        });
        return { buckets, startDateStr: getDayKey(firstDay) };
    }

    const firstMonth = startOfMonth(addMonths(now, -11));
    const buckets: Bucket[] = Array.from({ length: 12 }, (_, i) => {
        const d = addMonths(firstMonth, i);
        return {
            dateKey: getMonthKey(d),
            label: d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" }),
        };
    });
    return { buckets, startDateStr: getDayKey(firstMonth) };
}

function getRangeStart(range: string, now: Date) {
    if (range === "1d") return startOfDay(now);
    if (range === "1w") return startOfDay(addDays(now, -6));
    if (range === "1m") return startOfDay(addDays(now, -29));
    return startOfMonth(addMonths(now, -11));
}

function getBucketKey(date: Date, range: string) {
    if (range === "1d") return getHourKey(date);
    if (range === "all") return getMonthKey(date);
    return getDayKey(date);
}

type Bucket = {
    dateKey: string;
    label: string;
};
