/**
 * GET /api/host/events/[id]/attendees
 * Returns a POSH-style attendee list for a single host event.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireHostAccess } from "@/lib/server/hostAuthMiddleware";
import { getAdminDb } from "@/lib/firebase/admin";

function normalizeText(value: any) {
    return String(value || "").trim().toLowerCase();
}

function toIso(value: any) {
    return value?.toDate?.()?.toISOString?.() ?? value ?? null;
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

function maskName(name: string, allow: boolean) {
    if (allow || !name) return name;
    const parts = name.trim().split(" ");
    if (parts.length <= 1) return parts[0] || "Guest";
    return `${parts[0]} ${parts[parts.length - 1].charAt(0)}.`;
}

function getOrderQuantity(order: Record<string, any>) {
    if (Array.isArray(order.tickets) && order.tickets.length > 0) {
        return order.tickets.reduce((sum, ticket) => sum + Number(ticket?.quantity || 1), 0);
    }
    return Number(order.quantity || 1);
}

function getPrimaryTicket(order: Record<string, any>) {
    return Array.isArray(order.tickets) && order.tickets.length > 0 ? order.tickets[0] : null;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const ctx = await requireHostAccess(req, "VIEW_GUESTLIST");
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const { hostId, piiPolicy } = ctx as any;
    const db = getAdminDb();

    try {
        const eventDoc = await db.collection("events").doc(id).get();
        if (!eventDoc.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const ev = eventDoc.data()!;
        if (ev.hostId !== hostId && ev.creatorId !== hostId) {
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
                const primaryTicket = getPrimaryTicket(o);
                return {
                    id: doc.id,
                    attendeeId: o.userId || o.buyerId || doc.id,
                    fullName: maskName(o.buyerName || o.userName || o.displayName || "Guest", piiPolicy.showLastName),
                    email: maskEmail(o.email || o.userEmail || o.buyerEmail || "", piiPolicy.showEmail),
                    phone: maskPhone(o.phone || o.userPhone || o.buyerPhone || "", piiPolicy.showPhone),
                    instagram: o.instagram || o.instagramHandle || "",
                    ticketTier: primaryTicket?.name || o.tierName || o.ticketTypeName || "General",
                    tierId: primaryTicket?.ticketId || o.tierId || o.ticketTierId || "general",
                    quantity: getOrderQuantity(o),
                    totalSpend: Number(o.totalAmount || 0),
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
                const primaryTicket = getPrimaryTicket(o);
                return {
                    id: doc.id,
                    attendeeId: o.userId || doc.id,
                    fullName: maskName(o.userName || o.displayName || "Guest", piiPolicy.showLastName),
                    email: maskEmail(o.userEmail || o.email || "", piiPolicy.showEmail),
                    phone: maskPhone(o.userPhone || o.phone || "", piiPolicy.showPhone),
                    instagram: o.instagram || o.instagramHandle || "",
                    ticketTier: primaryTicket?.name || o.tierName || o.ticketTypeName || "RSVP",
                    tierId: primaryTicket?.ticketId || o.tierId || "rsvp",
                    quantity: getOrderQuantity(o),
                    totalSpend: Number(o.totalAmount || 0),
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
                return {
                    id: doc.id,
                    attendeeId: g.userId || doc.id,
                    fullName: maskName(g.displayName || g.name || "Guest", piiPolicy.showLastName),
                    email: maskEmail(g.email || "", piiPolicy.showEmail),
                    phone: maskPhone(g.phone || "", piiPolicy.showPhone),
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
        console.error("[host/events/[id]/attendees]", err.message);
        return NextResponse.json({ error: "Failed to fetch event attendees" }, { status: 500 });
    }
}
