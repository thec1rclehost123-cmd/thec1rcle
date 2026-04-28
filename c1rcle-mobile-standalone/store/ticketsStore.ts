/**
 * THE C1RCLE Mobile - Tickets/Orders Store
 * 
 * Fetches user orders from both "orders" and "rsvp_orders" collections.
 * Uses the same field names as the guest portal's orderStore.
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
    collection,
    query,
    where,
    orderBy,
    getDocs,
    doc,
    getDoc,
    Timestamp,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import { useEventsStore, toISOString, resolveImageUrl, resolvePoster } from "./eventsStore";
import { handleApiError } from "@/lib/errorHandler";

// ============================================================================
// TYPES
// ============================================================================

export interface OrderTicket {
    ticketId: string;
    name: string;
    quantity: number;
    price: number;
    subtotal: number;
    entryType?: string;
    // Enhanced fields for claims/sharing
    tierId?: string;
    isClaimed?: boolean;
    claimedBy?: {
        uid: string;
        email?: string;
        name?: string;
        photoURL?: string;
    } | null;
    requiredGender?: string;
    shareToken?: string;
    // Transfer fields
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

export interface Order {
    id: string;
    userId: string | null;
    userEmail: string;
    userName: string;

    // Event details (stored at order creation time - source of truth)
    eventId: string;
    eventTitle: string;
    eventImage?: string;
    eventDate?: string;     // Pre-formatted date string (e.g. "Jun 19th")
    eventStartDate?: string; // ISO String for machine processing
    eventTime?: string;     // Pre-formatted time string
    eventLocation?: string;
    hostName?: string;
    accentColor?: string;

    // Tickets
    tickets: OrderTicket[];
    totalAmount: number;
    currency: string;

    // Status
    status: "pending_payment" | "confirmed" | "checked_in" | "cancelled" | "refunded";
    isRSVP: boolean;

    // QR Codes
    qrCodes?: QRCode[];

    // Promo
    promoterCode?: string;
    discountAmount?: number;

    // Timestamps
    createdAt: string;
    updatedAt?: string;
    confirmedAt?: string;
    isClaimed?: boolean;
    bundleId?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Map Firestore order document to Order type
 */
function mapOrderDocument(docId: string, data: any): Order {
    return {
        id: docId,
        userId: data.userId || null,
        userEmail: data.userEmail || "",
        userName: data.userName || "",

        // Event details from order (source of truth - set at creation time)
        eventId: data.eventId,
        eventTitle: data.eventTitle || "Event",
        eventImage: resolvePoster(data),
        eventDate: data.eventDate || data.date || undefined,
        eventStartDate: toISOString(data.eventStartDate || data.startDate) || undefined,
        eventTime: data.eventTime || data.time || undefined,
        eventLocation: data.eventLocation || data.location || undefined,
        hostName: data.hostName || data.host?.name || data.host || undefined,
        accentColor: data.accentColor || undefined,

        // Tickets
        tickets: (data.tickets || []).map((t: any) => ({
            ticketId: t.ticketId || t.tierId || t.id,
            name: t.name || t.tierName || "General Entry",
            quantity: Number(t.quantity) || 1,
            price: Number(t.price) || 0,
            subtotal: Number(t.subtotal) || (Number(t.price) * Number(t.quantity)) || 0,
            entryType: t.entryType || "general",
            tierId: t.tierId,
            isClaimed: !!t.isClaimed || !!t.claimedBy,
            claimedBy: t.claimedBy || null,
            requiredGender: t.requiredGender,
            shareToken: t.shareToken,
        })),
        totalAmount: Number(data.totalAmount) || 0,
        currency: data.currency || "INR",

        // Status
        status: data.status || "confirmed",
        isRSVP: !!data.isRSVP,

        // QR Codes
        qrCodes: data.qrCodes || undefined,

        // Promo
        promoterCode: data.promoterCode || undefined,
        discountAmount: Number(data.discountAmount) || 0,

        // Timestamps
        createdAt: toISOString(data.createdAt) || new Date().toISOString(),
        updatedAt: toISOString(data.updatedAt),
        confirmedAt: toISOString(data.confirmedAt),
        isClaimed: !!data.isClaimed,
        bundleId: data.bundleId,
    };
}

// ============================================================================
// ZUSTAND STORE
// ============================================================================

interface TicketsState {
    orders: Order[];
    loading: boolean;
    error: string | null;

    fetchUserOrders: (userId: string) => Promise<void>;
    getOrderById: (orderId: string) => Promise<Order | null>;
    enrichOrderWithEvent: (order: Order) => Promise<Order>;
    getCurrentEventId: () => string | null;
    clearError: () => void;
}

export const useTicketsStore = create<TicketsState>()(
    persist(
        (set, get) => ({
            orders: [],
            loading: false,
            error: null,

            fetchUserOrders: async (userId: string) => {
                if (!userId) {
                    set({ orders: [], loading: false });
                    return;
                }

                set({ loading: true, error: null });

                try {
                    const db = getFirebaseDb();

                    // Fetch from all collections: orders, rsvp_orders, and ticket_assignments
                    const [ordersSnapshot, rsvpsSnapshot, claimsSnapshot] = await Promise.all([
                        getDocs(query(
                            collection(db, "orders"),
                            where("userId", "==", userId),
                            orderBy("createdAt", "desc")
                        )).catch(e => {
                            console.warn("[TicketsStore] Orders collection query failed:", e);
                            return { docs: [] };
                        }),
                        getDocs(query(
                            collection(db, "rsvp_orders"),
                            where("userId", "==", userId),
                            orderBy("createdAt", "desc")
                        )).catch(e => {
                            console.warn("[TicketsStore] RSVP collection query failed:", e);
                            return { docs: [] };
                        }),
                        getDocs(query(
                            collection(db, "ticket_assignments"),
                            where("redeemerId", "==", userId),
                            where("status", "==", "active")
                        )).catch(e => {
                            console.warn("[TicketsStore] Ticket assignments query failed:", e);
                            return { docs: [] };
                        }),
                    ]);

                    // Combine results
                    const allOrders: Order[] = [
                        ...ordersSnapshot.docs.map(doc => mapOrderDocument(doc.id, doc.data())),
                        ...rsvpsSnapshot.docs.map(doc => mapOrderDocument(doc.id, doc.data())),
                    ];

                    // Process claimed tickets into special Order objects
                    const claimedTickets: Order[] = claimsSnapshot.docs.map(d => {
                        const data = d.data();
                        return {
                            id: data.assignmentId || d.id,
                            userId: data.redeemerId,
                            userEmail: "", // We might not have this here
                            userName: "",
                            eventId: data.eventId,
                            eventTitle: data.eventTitle || "Claimed Ticket",
                            eventImage: resolveImageUrl(data.eventImage || data.image || data.poster),
                            eventDate: data.eventDate || undefined,
                            eventTime: data.eventTime || undefined,
                            eventLocation: data.eventLocation || undefined,
                            tickets: [{
                                ticketId: data.tierId,
                                name: data.ticketName || "Shared Entry",
                                quantity: 1,
                                price: 0,
                                subtotal: 0,
                                entryType: data.entryType || "general",
                                isClaimed: true,
                                receivedFrom: data.receivedFrom || undefined,
                                requiredGender: data.requiredGender || "any",
                                tierId: data.tierId
                            }],
                            totalAmount: 0,
                            currency: "INR",
                            status: "confirmed",
                            isRSVP: false,
                            qrCodes: [{
                                ticketId: data.tierId,
                                ticketIndex: 0,
                                qrCode: typeof data.qrPayload === 'string' ? data.qrPayload : JSON.stringify(data.qrPayload)
                            }],
                            createdAt: toISOString(data.claimedAt) || new Date().toISOString(),
                            isClaimed: true, // Special flag
                            bundleId: data.bundleId
                        } as any;
                    });

                    const combined = [...allOrders, ...claimedTickets];

                    // Sort by createdAt descending
                    combined.sort((a, b) =>
                        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                    );

                    // Filter to only confirmed/checked-in
                    const activeOrders = combined.filter(order =>
                        order.status === "confirmed" || order.status === "checked_in"
                    );

                    // Enrich orders with fresh event data (Posters!)
                    const enrichedOrders = await Promise.all(
                        activeOrders.map(order => get().enrichOrderWithEvent(order))
                    );

                    console.log(`[TicketsStore] Fetched ${enrichedOrders.length} tickets for user ${userId} (${claimedTickets.length} claimed)`);
                    set({ orders: enrichedOrders, loading: false });
                } catch (error: any) {
                    handleApiError(error, "fetchUserOrders");
                    set({ error: error.message, loading: false });
                }
            },

            getOrderById: async (orderId: string): Promise<Order | null> => {
                // Check cache first
                const { orders } = get();
                const cached = orders.find(o => o.id === orderId);
                if (cached) return cached;

                try {
                    const db = getFirebaseDb();

                    // Try orders collection first
                    let docSnap = await getDoc(doc(db, "orders", orderId));
                    if (docSnap.exists()) {
                        return mapOrderDocument(docSnap.id, docSnap.data());
                    }

                    // Try rsvp_orders collection
                    docSnap = await getDoc(doc(db, "rsvp_orders", orderId));
                    if (docSnap.exists()) {
                        return mapOrderDocument(docSnap.id, docSnap.data());
                    }

                    return null;
                    return null;
                } catch (error: any) {
                    handleApiError(error, "getOrderById");
                    return null;
                }
            },

            /**
             * Enrich order with fresh event data if needed
             * Useful when order's stored event data is incomplete
             */
            enrichOrderWithEvent: async (order: Order): Promise<Order> => {
                // If title is already "junk", don't bother enriching, it will be filtered out.
                const title = order.eventTitle?.toLowerCase() || "";
                if (!title || title === "event" || title === "untitled event") return order;

                try {
                    const { getEventById } = useEventsStore.getState();
                    const event = await getEventById(order.eventId);

                    if (event) {
                        // Priority for image: 
                        // 1. Fresh poster from Event document
                        // 2. Fresh cover image from Event document
                        // 3. Existing image from Order snapshot
                        const finalImage = event.posterUrl || event.coverImage || order.eventImage;

                        return {
                            ...order,
                            eventTitle: event.title || order.eventTitle,
                            eventImage: finalImage,
                            eventDate: event.date || order.eventDate,
                            eventStartDate: event.startDate || order.eventStartDate,
                            eventTime: event.time || order.eventTime,
                            eventLocation: event.venue || event.location || order.eventLocation,
                            accentColor: event.accentColor || order.accentColor,
                        };
                    }
                } catch (error) {
                    console.warn(`[TicketsStore] Could not enrich order ${order.id} with event data`);
                }

                return order;
            },

            /**
             * Get the event ID if the user is currently at an event
             * (Confirmed ticket and event is active in ±4h window)
             */
            getCurrentEventId: () => {
                const { orders } = get();
                const now = new Date();

                // Find confirmed orders for events happening roughly now
                const currentOrder = orders.find(order => {
                    if (order.status !== "confirmed" && order.status !== "checked_in") return false;

                    // If they are checked in, they are definitely at the event
                    if (order.status === "checked_in") return true;

                    // Otherwise check time window (±4 hours of event start)
                    if (order.eventDate) {
                        const eventDate = new Date(order.eventDate);
                        const diffMs = Math.abs(now.getTime() - eventDate.getTime());
                        const fourHoursMs = 4 * 60 * 60 * 1000;
                        return diffMs <= fourHoursMs;
                    }
                    return false;
                });

                return currentOrder?.eventId || null;
            },

            clearError: () => set({ error: null }),
        }),
        {
            name: "c1rcle-tickets-storage",
            storage: createJSONStorage(() => AsyncStorage),
            partialize: (state) => ({
                orders: state.orders,
            }),
        }
    )
);
