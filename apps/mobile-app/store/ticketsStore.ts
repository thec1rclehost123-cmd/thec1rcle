import { create } from "zustand";
import { apiFetch } from "@/lib/api";

// Order/Ticket type matching Firestore schema
export interface Order {
    id: string;
    userId: string;
    userEmail?: string;
    userName?: string;
    eventId: string;
    eventTitle?: string;
    eventDate?: string;
    eventStartDate?: string;
    eventTime?: string;
    eventCoverImage?: string;
    venueLocation?: string;
    hostName?: string;
    accentColor?: string;
    status: "pending_payment" | "confirmed" | "checked_in" | "cancelled" | "refunded";
    tickets: OrderTicket[];
    totalAmount: number;
    currency?: string;
    createdAt: string;
    updatedAt?: string;
    confirmedAt?: string;
    qrData?: string;
    qrCodes?: QRCode[];
    isClaimed?: boolean;
    bundleId?: string;
    isRSVP?: boolean;
    source?: string;
}

export interface OrderTicket {
    tierId: string;
    tierName: string;
    quantity: number;
    price: number;
    subtotal?: number;
    entryType?: string;
    ticketId?: string;
    isClaimed?: boolean;
    claimedBy?: {
        uid?: string;
        email?: string;
        name?: string;
        photoURL?: string;
    } | null;
    requiredGender?: string;
    shareToken?: string;
    transferStatus?: "pending" | "accepted" | "cancelled" | "expired";
    transferId?: string;
    transferRecipientEmail?: string;
    receivedFrom?: string;
}

export interface QRCode {
    ticketId: string;
    ticketIndex: number;
    qrCode: string;
    qrUrl?: string;
    isUsed?: boolean;
}

interface TicketsState {
    orders: Order[];
    loading: boolean;
    error: string | null;

    fetchUserOrders: (userId: string) => Promise<void>;
    getOrderById: (orderId: string) => Promise<Order | null>;
}

function toIso(value: any): string | null {
    try {
        if (!value) return null;
        if (typeof value === "string") return value;
        if (value instanceof Date) return value.toISOString();
        if (typeof value.toDate === "function") return value.toDate().toISOString();
        if (value.seconds != null) return new Date(value.seconds * 1000).toISOString();
    } catch {
        // ignore
    }
    return null;
}

function mapOrder(docId: string, data: any): Order {
    const eventDate =
        toIso(data.eventDate) ||
        toIso(data.eventStartDate) ||
        toIso(data.startDate) ||
        toIso(data.startAt) ||
        toIso(data.date);
    return {
        id: docId,
        userId: data.userId || data.uid || data.customerId || "",
        userEmail: data.userEmail || undefined,
        userName: data.userName || undefined,
        eventId: data.eventId || "",
        eventTitle: data.eventTitle || data.eventName || data.title,
        eventDate: eventDate || undefined,
        eventStartDate: toIso(data.eventStartDate) || toIso(data.startDate) || undefined,
        eventTime: data.eventTime || data.time || undefined,
        eventCoverImage: data.eventCoverImage || data.eventImage || data.image || data.posterUrl || data.poster,
        venueLocation: data.venueLocation || data.eventLocation || data.location || data.venue,
        hostName: data.hostName || data.host?.name || data.host || undefined,
        accentColor: data.accentColor || undefined,
        status: (data.status || "confirmed") as any,
        tickets: (data.tickets || []).map((t: any) => ({
            ticketId: t.ticketId || t.id,
            tierId: t.tierId || t.ticketId || t.id,
            tierName: t.tierName || t.name || "General Entry",
            quantity: Number(t.quantity) || 1,
            price: Number(t.price) || 0,
            subtotal: Number(t.subtotal) || (Number(t.price) || 0) * (Number(t.quantity) || 1),
            entryType: t.entryType,
            isClaimed: !!t.isClaimed || !!t.claimedBy,
            claimedBy: t.claimedBy || null,
            requiredGender: t.requiredGender || undefined,
            shareToken: t.shareToken || undefined,
            transferStatus: t.transferStatus || undefined,
            transferId: t.transferId || undefined,
            transferRecipientEmail: t.transferRecipientEmail || undefined,
            receivedFrom: t.receivedFrom || undefined,
        })),
        totalAmount: Number(data.totalAmount ?? data.total ?? 0),
        currency: data.currency || undefined,
        createdAt: toIso(data.createdAt) || new Date().toISOString(),
        updatedAt: toIso(data.updatedAt) || undefined,
        confirmedAt: toIso(data.confirmedAt) || undefined,
        qrData: data.qrData,
        qrCodes: (data.qrCodes || []).map((qr: any, index: number) => ({
            ticketId: qr.ticketId || qr.tierId || `${docId}-${index}`,
            ticketIndex: Number(qr.ticketIndex ?? index),
            qrCode: qr.qrCode || qr.qrData || JSON.stringify({ orderId: docId, index }),
            qrUrl: qr.qrUrl || undefined,
            isUsed: !!qr.isUsed,
        })),
        isClaimed: !!data.isClaimed,
        bundleId: data.bundleId || undefined,
        isRSVP: !!data.isRSVP || data.source === "rsvp",
        source: data.source,
    };
}

function mapAssignment(assignmentId: string, data: any, fallbackUserId: string): Order {
    return {
        id: data.assignmentId || assignmentId,
        userId: data.redeemerId || fallbackUserId,
        eventId: data.eventId,
        eventTitle: data.eventTitle || "Claimed Ticket",
        eventDate: toIso(data.eventDate) || toIso(data.eventStartDate) || toIso(data.startDate) || undefined,
        eventStartDate: toIso(data.eventStartDate) || toIso(data.eventDate) || toIso(data.startDate) || undefined,
        eventTime: data.eventTime || undefined,
        eventCoverImage: data.eventImage || data.image || data.poster || undefined,
        venueLocation: data.eventLocation || data.location || data.venue || undefined,
        hostName: data.hostName || undefined,
        status: "confirmed",
        tickets: [
            {
                ticketId: data.originalTicketId || data.ticketId || data.tierId,
                tierId: data.tierId || data.ticketId || data.originalTicketId || "shared",
                tierName: data.ticketName || data.tierName || "Shared Entry",
                quantity: Number(data.quantity) || 1,
                price: 0,
                subtotal: 0,
                entryType: data.entryType,
                isClaimed: true,
                requiredGender: data.requiredGender || undefined,
                receivedFrom: data.receivedFrom || undefined,
            },
        ],
        totalAmount: 0,
        createdAt: toIso(data.createdAt) || new Date().toISOString(),
        qrData: data.qrData,
        qrCodes: (data.qrCodes || []).map((qr: any, index: number) => ({
            ticketId: qr.ticketId || data.originalTicketId || `${assignmentId}-${index}`,
            ticketIndex: Number(qr.ticketIndex ?? index),
            qrCode: qr.qrCode || qr.qrData || JSON.stringify({ assignmentId, index }),
            qrUrl: qr.qrUrl || undefined,
            isUsed: !!qr.isUsed,
        })),
        isRSVP: true,
        source: "assignment",
    };
}

export const useTicketsStore = create<TicketsState>((set, get) => ({
    orders: [],
    loading: false,
    error: null,

    fetchUserOrders: async (userId: string) => {
        if (get().loading) return;
        set({ loading: true, error: null });

        try {
            const [ordersRes, ticketsRes] = await Promise.all([
                apiFetch<{ success: boolean; orders: any[] }>('/api/v1/orders').catch(() => ({ orders: [] })),
                apiFetch<{ orders: any[]; assignments: any[] }>('/api/v1/tickets/my-tickets').catch(() => ({ orders: [], assignments: [] }))
            ]);

            // ordersRes contains orders + rsvp_orders with enriched `event` data
            // ticketsRes contains basic orders + assignments

            const enrichedOrders = (ordersRes.orders || []).map((o: any) => {
                const mapped = mapOrder(o.id, o);
                if (o.event) {
                    mapped.eventTitle = o.event.title || mapped.eventTitle;
                    mapped.eventDate = o.event.startDate || o.event.date || mapped.eventDate;
                    mapped.eventCoverImage = o.event.image || o.event.poster || mapped.eventCoverImage;
                    mapped.venueLocation = o.event.venue || o.event.location || mapped.venueLocation;
                    mapped.hostName = o.event.hostName || o.event.host?.name || mapped.hostName;
                    mapped.eventStartDate = o.event.startDate || mapped.eventStartDate;
                    mapped.eventTime = o.event.time || mapped.eventTime;
                    mapped.accentColor = o.event.accentColor || mapped.accentColor;
                }
                return mapped;
            });
            
            const assignments = (ticketsRes.assignments || []).map((d: any) => mapAssignment(d.id, d, userId));

            const all: Order[] = [
                ...enrichedOrders,
                ...assignments,
            ]
                // keep only relevant statuses for wallet
                .filter((o) => ["confirmed", "checked_in"].includes(o.status));

            // Best-effort missing metadata resolution using /api/v1/events/:id
            const missingEventIds = Array.from(new Set(
                all
                    .filter((o) => o.eventId && (!o.eventTitle || !o.eventDate || !o.eventCoverImage))
                    .map((o) => o.eventId)
            ));

            if (missingEventIds.length) {
                const eventDocs = await Promise.all(
                    missingEventIds.map((id) =>
                        apiFetch<any>(`/api/v1/events/${id}`, { requireAuth: false }).catch(() => null)
                    )
                );
                const eventMap = new Map<string, any>();
                eventDocs.forEach((ev: any) => {
                    if (ev && ev.id) eventMap.set(ev.id, ev);
                });

                for (const o of all) {
                    const ev = eventMap.get(o.eventId);
                    if (!ev) continue;
                    if (!o.eventTitle) o.eventTitle = ev.title || ev.eventTitle || o.eventTitle;
                    if (!o.eventDate) o.eventDate = toIso(ev.startDate) || toIso(ev.date) || o.eventDate;
                    if (!o.eventStartDate) o.eventStartDate = toIso(ev.startDate) || toIso(ev.date) || o.eventStartDate;
                    if (!o.eventTime) o.eventTime = ev.time || o.eventTime;
                    if (!o.eventCoverImage) o.eventCoverImage = ev.image || ev.poster || ev.coverImage || o.eventCoverImage;
                    if (!o.venueLocation) o.venueLocation = ev.venue || ev.location || o.venueLocation;
                    if (!o.hostName) o.hostName = ev.hostName || ev.host?.name || ev.host || o.hostName;
                    if (!o.accentColor) o.accentColor = ev.accentColor || o.accentColor;
                }
            }

            set({ orders: all, loading: false });
        } catch (error: any) {
            console.error("Error fetching orders:", error);
            set({ error: error.message, loading: false });
        }
    },

    getOrderById: async (orderId: string): Promise<Order | null> => {
        try {
            const cached = get().orders.find((order) => order.id === orderId);
            if (cached) return cached;
            
            // To fetch single order, we can rely on our full orders list
            const ordersRes = await apiFetch<{ success: boolean; orders: any[] }>('/api/v1/orders').catch(() => null);
            if (ordersRes && ordersRes.orders) {
                const found = ordersRes.orders.find(o => o.id === orderId);
                if (found) {
                    return mapOrder(found.id, {
                        ...found,
                        source: found.isRSVP ? "rsvp" : undefined,
                    });
                }
            }

            // Fallback for assignments
            const ticketsRes = await apiFetch<{ orders: any[]; assignments: any[] }>('/api/v1/tickets/my-tickets').catch(() => null);
            if (ticketsRes && ticketsRes.assignments) {
                const foundAssign = ticketsRes.assignments.find(a => a.id === orderId || a.assignmentId === orderId);
                if (foundAssign) {
                    return mapAssignment(foundAssign.id, foundAssign, "unknown");
                }
            }

            return null;
        } catch (error: any) {
            console.error("Error fetching order by ID:", error);
            return null;
        }
    },
}));
