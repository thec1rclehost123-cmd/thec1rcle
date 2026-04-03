/**
 * GET /api/host/events/[id]/overview
 * Aggregated metrics for a single host-owned event.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireHostAccess } from "@/lib/server/hostAuthMiddleware";
import { getAdminDb } from "@/lib/firebase/admin";
import { listPromoterLinks } from "@/lib/server/promoterLinkStore";

function getEventTicketTiers(event: Record<string, any>) {
    if (Array.isArray(event.ticketTiers)) return event.ticketTiers;
    if (Array.isArray(event.tiers)) return event.tiers;
    if (Array.isArray(event.ticketCatalog?.tiers)) return event.ticketCatalog.tiers;
    if (Array.isArray(event.tickets)) return event.tickets;
    return [];
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

function getDateKeyInTimeZone(date: Date, timeZone: string) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);

    const year = parts.find((part) => part.type === "year")?.value || "0000";
    const month = parts.find((part) => part.type === "month")?.value || "01";
    const day = parts.find((part) => part.type === "day")?.value || "01";
    return `${year}-${month}-${day}`;
}

function getHourInTimeZone(date: Date, timeZone: string) {
    const hour = new Intl.DateTimeFormat("en-US", {
        timeZone,
        hour: "numeric",
        hourCycle: "h23",
    }).format(date);

    return Number(hour);
}

function formatDayLabel(dateKey: string) {
    const [year, month, day] = dateKey.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.toLocaleDateString("en-IN", {
        month: "short",
        day: "numeric",
        timeZone: "UTC",
    });
}

function formatHourLabel(hour: number) {
    return new Intl.DateTimeFormat("en-IN", {
        hour: "numeric",
        hour12: true,
        timeZone: "UTC",
    }).format(new Date(Date.UTC(2024, 0, 1, hour)));
}

function getOrderItems(order: Record<string, any>) {
    if (Array.isArray(order.tickets) && order.tickets.length > 0) {
        return order.tickets.map((ticket: any, index: number) => ({
            id: ticket.ticketId || ticket.tierId || ticket.id || `ticket-${index}`,
            name: ticket.name || ticket.tierName || ticket.ticketTypeName || "General",
            quantity: Number(ticket.quantity || 1),
            amount: Number(ticket.finalPrice ?? ticket.subtotal ?? ticket.price ?? 0),
        }));
    }

    return [{
        id: order.tierId || order.ticketTierId || order.tierName || "general",
        name: order.tierName || order.ticketTypeName || order.tierLabel || "General",
        quantity: Number(order.quantity || 1),
        amount: Number(order.totalAmount || 0),
    }];
}

function ownsHostEvent(event: Record<string, any>, hostId: string) {
    return event.hostId === hostId || event.creatorId === hostId;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const ctx = await requireHostAccess(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const { hostId } = ctx;
    const db = getAdminDb();

    try {
        const eventDoc = await db.collection("events").doc(id).get();
        if (!eventDoc.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const ev = eventDoc.data()!;
        const eventTimeZone = ev.timezone || "Asia/Kolkata";
        if (!ownsHostEvent(ev, hostId)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const ordersSnap = await db.collection("orders")
            .where("eventId", "==", id)
            .where("status", "in", ["completed", "confirmed", "checked_in"])
            .get();

        let ticketsSold = 0;
        let grossRevenue = 0;
        let checkedInCount = 0;
        const attendeeCounts = new Map<string, number>();
        const ticketMix = new Map<string, { tierId: string; tierName: string; sold: number; revenue: number }>();
        const areaCounts = new Map<string, number>();
        const salesTimeline = new Map<string, { date: string; label: string; tickets: number; revenue: number; checkIns: number }>();
        const hourlyTimeline = Array.from({ length: 24 }, (_, hour) => ({
            hour,
            label: formatHourLabel(hour),
            tickets: 0,
            revenue: 0,
            checkIns: 0,
        }));

        const bumpDayBucket = (value: Date | null, patch: Partial<{ tickets: number; revenue: number; checkIns: number }>) => {
            if (!value) return;
            const key = getDateKeyInTimeZone(value, eventTimeZone);
            const bucket = salesTimeline.get(key) || {
                date: key,
                label: formatDayLabel(key),
                tickets: 0,
                revenue: 0,
                checkIns: 0,
            };

            bucket.tickets += patch.tickets || 0;
            bucket.revenue += patch.revenue || 0;
            bucket.checkIns += patch.checkIns || 0;
            salesTimeline.set(key, bucket);
        };

        const bumpHourBucket = (value: Date | null, patch: Partial<{ tickets: number; revenue: number; checkIns: number }>) => {
            if (!value) return;
            const hour = getHourInTimeZone(value, eventTimeZone);
            const bucket = hourlyTimeline[hour];
            if (!bucket) return;

            bucket.tickets += patch.tickets || 0;
            bucket.revenue += patch.revenue || 0;
            bucket.checkIns += patch.checkIns || 0;
        };

        for (const doc of ordersSnap.docs) {
            const o = doc.data();
            const total = Number(o.totalAmount || 0);
            const items = getOrderItems(o);
            const qty = items.reduce((sum, item) => sum + item.quantity, 0);
            const attendeeKey = o.userId || o.buyerId || o.email || o.phone || doc.id;
            const locationLabel = [o.area, o.locality, o.neighborhood, o.city].filter(Boolean)[0];
            const purchaseDate = toDate(o.createdAt || o.completedAt || o.updatedAt);
            const checkInDate = toDate(o.checkedInAt || o.scannedAt);
            const isCheckedIn = Boolean(o.checkedIn || o.scanned || o.status === "checked_in");

            ticketsSold += qty;
            grossRevenue += total;
            checkedInCount += isCheckedIn ? qty : 0;
            attendeeCounts.set(attendeeKey, (attendeeCounts.get(attendeeKey) || 0) + qty);
            if (locationLabel) areaCounts.set(locationLabel, (areaCounts.get(locationLabel) || 0) + qty);

            for (const item of items) {
                const mix = ticketMix.get(item.id) || { tierId: item.id, tierName: item.name, sold: 0, revenue: 0 };
                mix.sold += item.quantity;
                mix.revenue += item.amount > 0 ? item.amount : (qty > 0 ? (total * item.quantity) / qty : 0);
                ticketMix.set(item.id, mix);
            }

            bumpDayBucket(purchaseDate, { tickets: qty, revenue: total });
            bumpHourBucket(purchaseDate, { tickets: qty, revenue: total });
            if (isCheckedIn) {
                bumpDayBucket(checkInDate || purchaseDate, { checkIns: qty });
                bumpHourBucket(checkInDate || purchaseDate, { checkIns: qty });
            }
        }

        const glSnap = await db.collection("guest_lists")
            .where("eventId", "==", id)
            .get();

        let guestlistCheckedIn = 0;
        for (const doc of glSnap.docs) {
            const g = doc.data();
            const guestKey = g.userId || g.phone || g.email || doc.id;
            const locationLabel = [g.area, g.locality, g.neighborhood, g.city].filter(Boolean)[0];
            const guestAddedDate = toDate(g.addedAt || g.createdAt);
            const guestCheckInDate = toDate(g.checkedInAt);
            attendeeCounts.set(guestKey, (attendeeCounts.get(guestKey) || 0) + 1);
            if (g.checkedIn) guestlistCheckedIn += 1;
            if (locationLabel) areaCounts.set(locationLabel, (areaCounts.get(locationLabel) || 0) + 1);
            if (g.checkedIn) {
                bumpDayBucket(guestCheckInDate || guestAddedDate, { checkIns: 1 });
                bumpHourBucket(guestCheckInDate || guestAddedDate, { checkIns: 1 });
            }
        }

        const promoterLinks = await listPromoterLinks({ eventId: id, limit: 200 });
        const promoterStats = promoterLinks.reduce((map, link) => {
            const promoterId = String(link.promoterId || link.id);
            const current = map.get(promoterId) || { name: link.promoterName || "Promoter", sales: 0, revenue: 0 };
            current.sales += Number(link.conversions || 0);
            current.revenue += Number(link.revenue || 0);
            map.set(promoterId, current);
            return map;
        }, new Map<string, { name: string; sales: number; revenue: number }>());
        const topPromoter = [...promoterStats.values()].sort((a, b) => b.revenue - a.revenue)[0] || null;

        const platformFee = grossRevenue * 0.1;
        const hostNet = grossRevenue - platformFee;
        const guestListSize = glSnap.size;
        const totalGuests = ticketsSold + guestListSize;
        const totalCheckedIn = checkedInCount + guestlistCheckedIn;
        const conversionRate = totalGuests > 0 ? Number(((ticketsSold / totalGuests) * 100).toFixed(1)) : 0;
        const sellThrough = ev.capacity ? Number(((ticketsSold / Math.max(ev.capacity, 1)) * 100).toFixed(1)) : 0;
        const repeatGuests = [...attendeeCounts.values()].filter((count) => count > 1).length;
        const uniqueAttendees = attendeeCounts.size;
        const topTier = [...ticketMix.values()].sort((a, b) => b.sold - a.sold)[0] || null;
        const locationDistribution = [...areaCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([label, value]) => ({ label, value }));
        const orderedSalesTimeline = [...salesTimeline.values()].sort((a, b) => a.date.localeCompare(b.date));
        const peakSalesHour = [...hourlyTimeline].sort((a, b) => b.revenue - a.revenue)[0] || null;
        const peakCheckInHour = [...hourlyTimeline].sort((a, b) => b.checkIns - a.checkIns)[0] || null;
        const ticketTiers = getEventTicketTiers(ev);
        const inventory = ticketTiers.reduce((sum: number, tier: any) => sum + Number(tier.quantity || tier.maxQuantity || 0), 0);

        return NextResponse.json({
            ticketsSold,
            grossRevenue: Math.round(grossRevenue),
            estimatedEarnings: Math.round(hostNet),
            guestListSize,
            totalCheckedIn,
            conversionRate,
            sellThrough,
            uniqueAttendees,
            repeatGuests,
            firstTimeGuests: Math.max(uniqueAttendees - repeatGuests, 0),
            topTier,
            locationDistribution,
            ticketMix: [...ticketMix.values()].sort((a, b) => b.sold - a.sold),
            inventory,
            capacity: ev.capacity || ev.totalCapacity || 0,
            isPublic: Boolean(ev.settings?.showExplore ?? ev.showExplore ?? true),
            isLiveEditable: ["live", "scheduled", "approved", "completed", "submitted"].includes((ev.lifecycle || ev.status || "").toLowerCase()),
            topPromoter,
            views: Number(ev.stats?.views || 0),
            saves: Number(ev.stats?.saves || 0),
            salesTimeline: orderedSalesTimeline,
            hourlyTimeline,
            peakSalesHour,
            peakCheckInHour,
            timeZone: eventTimeZone,
        });
    } catch (err: any) {
        console.error("[host/events/[id]/overview]", err.message);
        return NextResponse.json({ error: "Failed to fetch event overview" }, { status: 500 });
    }
}
