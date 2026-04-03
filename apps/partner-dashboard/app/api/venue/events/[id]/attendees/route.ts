/**
 * GET /api/venue/events/[id]/attendees
 * Returns a venue-scoped attendee list for a single event.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireVenueAccess } from "@/lib/rbac/staffProfileEnforcer";
import { getAdminDb } from "@/lib/firebase/admin";
import {
    getOrderAmount,
    getOrderCustomerName,
    getOrderEmail,
    getOrderPhone,
    getTicketsCount,
} from "@/lib/server/orderTracking";

function normalizeText(value: any) {
    return String(value || "").trim().toLowerCase();
}

function toIso(value: any) {
    return value?.toDate?.()?.toISOString?.() ?? value ?? null;
}

function maskEmail(e: string) {
    if (!e) return "";
    const [l, d] = e.split("@");
    return d ? `${l.slice(0, 2)}***@${d}` : e;
}

function maskPhone(p: string) {
    if (!p) return "";
    return p.length > 4 ? `${"*".repeat(p.length - 4)}${p.slice(-4)}` : "****";
}

function maskName(name: string) {
    if (!name) return "Guest";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const ctx = await requireVenueAccess(req, "guestlist:read");
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const { venueId, piiPolicy } = ctx as any;
    const db = getAdminDb();

    try {
        const eventDoc = await db.collection("events").doc(id).get();
        if (!eventDoc.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const ev = eventDoc.data()!;
        if (ev.venueId !== venueId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const url = new URL(req.url);
        const q = normalizeText(url.searchParams.get("q"));
        const sourceFilter = url.searchParams.get("source");
        const statusFilter = url.searchParams.get("status");
        const tierFilter = url.searchParams.get("tierId");
        const vipFilter = url.searchParams.get("vip");
        const sort = url.searchParams.get("sort") || "newest";
        const page = Math.max(parseInt(url.searchParams.get("page") || "1", 10), 1);
        const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "25", 10), 1), 100);

        const [ordersSnap, rsvpSnap, guestlistSnap] = await Promise.all([
            db.collection("orders").where("eventId", "==", id).get(),
            db.collection("rsvp_orders").where("eventId", "==", id).get(),
            db.collection("guest_lists").where("eventId", "==", id).get(),
        ]);

        const attendees = [
            ...ordersSnap.docs.map((doc) => {
                const o = doc.data();
                const fullName = getOrderCustomerName(o);
                const email = getOrderEmail(o);
                const phone = getOrderPhone(o);
                return {
                    id: doc.id,
                    attendeeId: o.userId || o.buyerId || doc.id,
                    fullName: piiPolicy.showLastName ? fullName : maskName(fullName),
                    email: piiPolicy.showEmail ? email : maskEmail(email),
                    phone: piiPolicy.showPhone ? phone : maskPhone(phone),
                    instagram: o.instagram || o.instagramHandle || "",
                    ticketTier: o.tierName || o.ticketTypeName || "General",
                    tierId: o.tierId || o.ticketTierId || "general",
                    quantity: getTicketsCount(o),
                    totalSpend: getOrderAmount(o),
                    source: "ticket",
                    status: o.status === "refunded" ? "refunded" : (o.checkedIn || o.scanned || o.status === "checked_in") ? "checked_in" : "registered",
                    purchasedAt: toIso(o.createdAt),
                    checkedInAt: toIso(o.checkedInAt || o.scannedAt),
                    city: o.city || "",
                    area: o.area || o.locality || o.neighborhood || "",
                    isVip: Boolean(o.isVip),
                    tags: o.tags || [],
                    orderId: doc.id,
                    orderSummary: `Order #${doc.id.slice(0, 6).toUpperCase()}`,
                };
            }),
            ...rsvpSnap.docs.map((doc) => {
                const o = doc.data();
                const fullName = getOrderCustomerName(o);
                const email = getOrderEmail(o);
                const phone = getOrderPhone(o);
                return {
                    id: doc.id,
                    attendeeId: o.userId || doc.id,
                    fullName: piiPolicy.showLastName ? fullName : maskName(fullName),
                    email: piiPolicy.showEmail ? email : maskEmail(email),
                    phone: piiPolicy.showPhone ? phone : maskPhone(phone),
                    instagram: o.instagram || o.instagramHandle || "",
                    ticketTier: o.tierName || o.ticketTypeName || "RSVP",
                    tierId: o.tierId || "rsvp",
                    quantity: getTicketsCount(o),
                    totalSpend: getOrderAmount(o),
                    source: "rsvp",
                    status: o.checkedIn || o.scanned || o.status === "checked_in" ? "checked_in" : "registered",
                    purchasedAt: toIso(o.createdAt),
                    checkedInAt: toIso(o.checkedInAt || o.scannedAt),
                    city: o.city || "",
                    area: o.area || o.locality || o.neighborhood || "",
                    isVip: Boolean(o.isVip),
                    tags: o.tags || [],
                    orderId: doc.id,
                    orderSummary: `Order #${doc.id.slice(0, 6).toUpperCase()}`,
                };
            }),
            ...guestlistSnap.docs.map((doc) => {
                const g = doc.data();
                const fullName = g.displayName || g.name || "Guest";
                const email = (g.email || "") as string;
                const phone = (g.phone || "") as string;
                return {
                    id: doc.id,
                    attendeeId: g.userId || doc.id,
                    fullName: piiPolicy.showLastName ? fullName : maskName(fullName),
                    email: piiPolicy.showEmail ? email : maskEmail(email),
                    phone: piiPolicy.showPhone ? phone : maskPhone(phone),
                    instagram: g.instagram || g.instagramHandle || "",
                    ticketTier: g.tierName || (g.isVip ? "VIP Guestlist" : "Guestlist"),
                    tierId: g.tierId || "guestlist",
                    quantity: 1,
                    totalSpend: Number(g.totalSpend || 0),
                    source: g.source || "manual",
                    status: g.checkedIn ? "checked_in" : g.approved === false ? "denied" : g.requiresApproval ? "pending_approval" : "registered",
                    purchasedAt: toIso(g.addedAt),
                    checkedInAt: toIso(g.checkedInAt),
                    city: g.city || "",
                    area: g.area || g.locality || g.neighborhood || "",
                    isVip: Boolean(g.isVip),
                    tags: g.tags || [],
                    orderId: g.orderId || "",
                    orderSummary: g.notes || "Guestlist entry",
                };
            }),
        ];

        const filtered = attendees
            .filter((row) => {
                if (q) {
                    const haystack = [row.fullName, row.email, row.phone, row.instagram].map(normalizeText).join(" ");
                    if (!haystack.includes(q)) return false;
                }
                if (sourceFilter && row.source !== sourceFilter) return false;
                if (statusFilter && row.status !== statusFilter) return false;
                if (tierFilter && row.tierId !== tierFilter) return false;
                if (vipFilter === "true" && !row.isVip) return false;
                return true;
            })
            .sort((a, b) => {
                if (sort === "spend_desc") return b.totalSpend - a.totalSpend;
                if (sort === "tickets_desc") return b.quantity - a.quantity;
                if (sort === "last_checkin") return (new Date(b.checkedInAt || 0).getTime()) - (new Date(a.checkedInAt || 0).getTime());
                return (new Date(b.purchasedAt || 0).getTime()) - (new Date(a.purchasedAt || 0).getTime());
            });

        const start = (page - 1) * limit;
        const pageRows = filtered.slice(start, start + limit);
        const tierOptions = [...new Set(attendees.map((row) => JSON.stringify({ id: row.tierId, name: row.ticketTier })))].map((value) => JSON.parse(value));

        return NextResponse.json({
            attendees: pageRows,
            pagination: {
                page,
                limit,
                total: filtered.length,
                totalPages: Math.max(Math.ceil(filtered.length / limit), 1),
            },
            filters: {
                tierOptions,
                sourceOptions: [...new Set(attendees.map((row) => row.source))],
                statusOptions: [...new Set(attendees.map((row) => row.status))],
            },
        });
    } catch (err: any) {
        console.error("[venue/events/[id]/attendees]", err.message);
        return NextResponse.json({ error: "Failed to fetch event attendees" }, { status: 500 });
    }
}
