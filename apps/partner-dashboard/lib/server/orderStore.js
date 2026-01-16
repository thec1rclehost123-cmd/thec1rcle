import { randomUUID } from "node:crypto";
import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";
import { getEvent } from "./eventStore";
import { sendTicketEmail } from "../email"; // Import email sender for delayed sending

const ORDERS_COLLECTION = "orders";
const RSVP_COLLECTION = "rsvp_orders";

// In-memory fallback for development without Firebase
let fallbackOrders = [];
let fallbackRSVPs = [];

const generateOrderId = (prefix = "ORD") => {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `${prefix}-${timestamp}-${random}`;
};

const calculateOrderTotal = (tickets) => {
    return tickets.reduce((sum, ticket) => {
        return sum + (Number(ticket.price) || 0) * (Number(ticket.quantity) || 0);
    }, 0);
};

const mapOrderDocument = (doc) => {
    const data = doc.data();
    return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate?.() ? data.createdAt.toDate().toISOString() : data.createdAt,
        updatedAt: data.updatedAt?.toDate?.() ? data.updatedAt.toDate().toISOString() : data.updatedAt,
    };
};

/**
 * Create an order and update ticket inventory atomically
 * Includes promoter attribution if a promoter code is provided
 */
export async function createOrder(payload) {
    const {
        eventId,
        tickets, // Array of { ticketId, quantity }
        userId,
        userEmail,
        userName,
        paymentMethod = "card",
        promoterCode = null, // Optional: Promoter referral code
    } = payload;

    // Validate tickets array
    if (!Array.isArray(tickets) || tickets.length === 0) {
        const error = new Error("Tickets must be a non-empty array");
        error.statusCode = 400;
        throw error;
    }

    // Fetch event to validate and get ticket details
    const event = await getEvent(eventId);
    if (!event) {
        const error = new Error(`Event not found: ${eventId}`);
        error.statusCode = 404;
        throw error;
    }

    // Build order tickets with full details
    const orderTickets = [];
    const ticketUpdates = []; // Track what needs to be updated

    for (const selectedTicket of tickets) {
        const { ticketId, quantity } = selectedTicket;

        if (!ticketId || !quantity || quantity <= 0) {
            const error = new Error("Each ticket must have a valid ticketId and quantity > 0");
            error.statusCode = 400;
            throw error;
        }

        // Find the ticket in the event
        const eventTicket = event.tickets?.find(t => t.id === ticketId);
        if (!eventTicket) {
            const error = new Error(`Ticket not found: ${ticketId}`);
            error.statusCode = 404;
            throw error;
        }

        // Check if enough tickets are available
        const available = Number(eventTicket.remaining ?? eventTicket.quantity) || 0;
        if (available < quantity) {
            throw new Error(
                `Not enough tickets available for "${eventTicket.name}". Requested: ${quantity}, Available: ${available}`
            );
        }

        orderTickets.push({
            ticketId: eventTicket.id,
            name: eventTicket.name,
            price: Number(eventTicket.price) || 0,
            quantity: Number(quantity),
            subtotal: (Number(eventTicket.price) || 0) * Number(quantity),
        });

        ticketUpdates.push({
            ticketId: eventTicket.id,
            quantity: Number(quantity),
        });
    }

    const totalAmount = calculateOrderTotal(orderTickets);
    const orderId = generateOrderId();
    const now = new Date().toISOString();

    // Promoter attribution - resolve link from code if provided
    let promoterAttribution = null;
    if (promoterCode) {
        try {
            const { getPromoterLinkByCode } = await import("./promoterLinkStore");
            const promoterLink = await getPromoterLinkByCode(promoterCode);
            if (promoterLink && promoterLink.isActive) {
                const commissionRate = promoterLink.commissionRate || 15;
                const commissionAmount = Math.round(totalAmount * (commissionRate / 100));
                promoterAttribution = {
                    linkId: promoterLink.id,
                    code: promoterLink.code,
                    promoterId: promoterLink.promoterId,
                    promoterName: promoterLink.promoterName,
                    commissionRate,
                    commissionAmount,
                };
            }
        } catch (e) {
            console.warn("Failed to resolve promoter code:", e.message);
        }
    }

    const order = {
        id: orderId,
        eventId,
        eventTitle: event.title,
        eventImage: event.image,
        eventDate: event.date,
        eventTime: event.time,
        eventLocation: event.location,
        userId: userId || null,
        userEmail: userEmail || "",
        userName: userName || "",
        tickets: orderTickets,
        totalAmount,
        currency: "INR",
        paymentMethod,
        status: "pending_payment", // Default to pending for the "Fintech" flow
        // Promoter attribution
        promoterCode: promoterCode || null,
        promoterAttribution,
        createdAt: now,
        updatedAt: now,
    };

    // If Firebase is not configured, use fallback
    if (!isFirebaseConfigured()) {
        // Update fallback event tickets
        const eventIndex = require("../../data/events").events.findIndex(e => e.id === eventId);
        if (eventIndex >= 0) {
            const events = require("../../data/events").events;
            ticketUpdates.forEach(update => {
                const ticket = events[eventIndex].tickets?.find(t => t.id === update.ticketId);
                if (ticket) {
                    ticket.remaining = Math.max(0, (ticket.remaining ?? ticket.quantity) - update.quantity);
                }
            });
        }

        fallbackOrders.push(order);
        return order;
    }

    // Use Firestore transaction to ensure atomic updates
    const db = getAdminDb();

    try {
        await db.runTransaction(async (transaction) => {
            const eventRef = db.collection("events").doc(eventId);
            const eventDoc = await transaction.get(eventRef);

            if (!eventDoc.exists) {
                throw new Error(`Event not found in transaction: ${eventId}`);
            }

            const currentEvent = eventDoc.data();
            const updatedTickets = [...(currentEvent.tickets || [])];

            // Update ticket inventory
            for (const update of ticketUpdates) {
                const ticketIndex = updatedTickets.findIndex(t => t.id === update.ticketId);
                if (ticketIndex === -1) {
                    throw new Error(`Ticket not found in event: ${update.ticketId}`);
                }

                const currentRemaining = Number(updatedTickets[ticketIndex].remaining ?? updatedTickets[ticketIndex].quantity) || 0;

                if (currentRemaining < update.quantity) {
                    throw new Error(
                        `Ticket sold out during purchase: "${updatedTickets[ticketIndex].name}". Available: ${currentRemaining}`
                    );
                }

                updatedTickets[ticketIndex].remaining = currentRemaining - update.quantity;
            }

            // Update event with new ticket counts
            transaction.update(eventRef, {
                tickets: updatedTickets,
                updatedAt: now,
            });

            // Create order document
            const orderRef = db.collection(ORDERS_COLLECTION).doc(orderId);
            transaction.set(orderRef, order);
        });

        console.log(`Order created successfully: ${orderId}`);
        return order;
    } catch (error) {
        console.error("Transaction failed:", error);
        throw error;
    }
}

/**
 * Get order by ID
 */
export async function getOrderById(orderId) {
    if (!orderId) return null;

    if (!isFirebaseConfigured()) {
        return fallbackOrders.find(o => o.id === orderId) || null;
    }

    const db = getAdminDb();
    const doc = await db.collection(ORDERS_COLLECTION).doc(orderId).get();

    if (!doc.exists) {
        return null;
    }

    return mapOrderDocument(doc);
}

/**
 * Get all orders for a specific user (including RSVP)
 */
export async function getUserOrders(userId, limit = 50) {
    if (!userId) return [];

    if (!isFirebaseConfigured()) {
        const combined = [...fallbackOrders, ...fallbackRSVPs]
            .filter(o => o.userId === userId)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return combined.slice(0, limit);
    }

    const db = getAdminDb();
    const [ordersSnapshot, rsvpsSnapshot] = await Promise.all([
        db.collection(ORDERS_COLLECTION).where("userId", "==", userId).orderBy("createdAt", "desc").limit(limit).get(),
        db.collection(RSVP_COLLECTION).where("userId", "==", userId).orderBy("createdAt", "desc").limit(limit).get()
    ]);

    const allOrders = [
        ...ordersSnapshot.docs.map(mapOrderDocument),
        ...rsvpsSnapshot.docs.map(mapOrderDocument)
    ];

    allOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return allOrders.slice(0, limit);
}

/**
 * Get all orders for a specific event (including RSVP)
 */
export async function getEventOrders(eventId, limit = 100) {
    if (!eventId) return [];

    if (!isFirebaseConfigured()) {
        const combined = [...fallbackOrders, ...fallbackRSVPs]
            .filter(o => o.eventId === eventId)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        return combined.slice(0, limit);
    }

    const db = getAdminDb();
    const [ordersSnapshot, rsvpsSnapshot] = await Promise.all([
        db.collection(ORDERS_COLLECTION).where("eventId", "==", eventId).orderBy("createdAt", "desc").limit(limit).get(),
        db.collection(RSVP_COLLECTION).where("eventId", "==", eventId).orderBy("createdAt", "desc").limit(limit).get()
    ]);

    const allOrders = [
        ...ordersSnapshot.docs.map(mapOrderDocument),
        ...rsvpsSnapshot.docs.map(mapOrderDocument)
    ];

    allOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return allOrders.slice(0, limit);
}

/**
 * Calculate ticket sales statistics for an event
 */
export async function getEventSalesStats(eventId) {
    const orders = await getEventOrders(eventId);

    const stats = {
        totalOrders: orders.length,
        totalRevenue: 0,
        ticketsSold: {},
        totalTicketsSold: 0,
    };

    orders.forEach(order => {
        // Only count Paid orders in Sales Stats; exclude RSVPs
        if (order.status === "confirmed" && !order.isRSVP) {
            stats.totalRevenue += Number(order.totalAmount) || 0;

            order.tickets.forEach(ticket => {
                if (!stats.ticketsSold[ticket.ticketId]) {
                    stats.ticketsSold[ticket.ticketId] = {
                        name: ticket.name,
                        quantity: 0,
                        revenue: 0,
                    };
                }
                stats.ticketsSold[ticket.ticketId].quantity += Number(ticket.quantity);
                stats.ticketsSold[ticket.ticketId].revenue += Number(ticket.subtotal);
                stats.totalTicketsSold += Number(ticket.quantity);
            });
        }
    });

    // Recalculate total orders to reflect only paid transactions
    stats.totalOrders = orders.filter(o => o.status === "confirmed" && !o.isRSVP).length;

    return stats;
}

/**
 * Cancel an order and restore ticket inventory
 */
export async function cancelOrder(orderId) {
    const order = await getOrderById(orderId);

    if (!order) {
        throw new Error("Order not found");
    }

    if (order.status === "cancelled") {
        return order; // Already cancelled
    }

    const now = new Date().toISOString();

    if (!isFirebaseConfigured()) {
        const orderIndex = fallbackOrders.findIndex(o => o.id === orderId);
        if (orderIndex >= 0) {
            fallbackOrders[orderIndex].status = "cancelled";
            fallbackOrders[orderIndex].updatedAt = now;

            // Restore ticket inventory
            const events = require("../../data/events").events;
            const eventIndex = events.findIndex(e => e.id === order.eventId);
            if (eventIndex >= 0) {
                order.tickets.forEach(orderTicket => {
                    const ticket = events[eventIndex].tickets?.find(t => t.id === orderTicket.ticketId);
                    if (ticket) {
                        ticket.remaining = (ticket.remaining ?? ticket.quantity) + orderTicket.quantity;
                    }
                });
            }

            return fallbackOrders[orderIndex];
        }
        throw new Error("Order not found");
    }

    const db = getAdminDb();

    await db.runTransaction(async (transaction) => {
        const eventRef = db.collection("events").doc(order.eventId);
        const eventDoc = await transaction.get(eventRef);

        if (eventDoc.exists) {
            const currentEvent = eventDoc.data();
            const updatedTickets = [...(currentEvent.tickets || [])];

            // Restore ticket inventory
            order.tickets.forEach(orderTicket => {
                const ticketIndex = updatedTickets.findIndex(t => t.id === orderTicket.ticketId);
                if (ticketIndex >= 0) {
                    const currentRemaining = Number(updatedTickets[ticketIndex].remaining ?? updatedTickets[ticketIndex].quantity) || 0;
                    updatedTickets[ticketIndex].remaining = currentRemaining + orderTicket.quantity;
                }
            });

            transaction.update(eventRef, {
                tickets: updatedTickets,
                updatedAt: now,
            });
        }

        // Update order status
        const orderRef = db.collection(ORDERS_COLLECTION).doc(orderId);
        transaction.update(orderRef, {
            status: "cancelled",
            updatedAt: now,
        });
    });

    return { ...order, status: "cancelled", updatedAt: now };
}


/**
 * Update order status (e.g., from Webhook)
 * Records promoter conversion when order is confirmed
 */
export async function updateOrderStatus(orderId, status, paymentDetails = {}) {
    const order = await getOrderById(orderId);
    if (!order) throw new Error("Order not found");

    const now = new Date().toISOString();
    const updates = {
        status,
        updatedAt: now,
        paymentDetails: {
            ...order.paymentDetails,
            ...paymentDetails
        }
    };

    // Record promoter conversion when order is confirmed
    const shouldRecordConversion = status === "confirmed" && order.status !== "confirmed" && order.promoterAttribution;

    if (!isFirebaseConfigured()) {
        const index = fallbackOrders.findIndex(o => o.id === orderId);
        if (index >= 0) {
            fallbackOrders[index] = { ...fallbackOrders[index], ...updates };

            // Record conversion for promoter
            if (shouldRecordConversion) {
                console.log(`[OrderStore] Recording promoter conversion for order ${orderId}`);
                try {
                    const { recordConversion } = await import("./promoterLinkStore");
                    await recordConversion(
                        order.promoterAttribution.linkId,
                        orderId,
                        order.totalAmount,
                        order.tickets[0]?.ticketId
                    );
                } catch (e) {
                    console.warn("Failed to record promoter conversion:", e.message);
                }
            }

            return fallbackOrders[index];
        }
    }

    const db = getAdminDb();
    await db.collection(ORDERS_COLLECTION).doc(orderId).update(updates);

    // Record promoter conversion in Firebase env
    if (shouldRecordConversion) {
        console.log(`[OrderStore] Recording promoter conversion for order ${orderId}`);
        try {
            const { recordConversion } = await import("./promoterLinkStore");
            await recordConversion(
                order.promoterAttribution.linkId,
                orderId,
                order.totalAmount,
                order.tickets[0]?.ticketId
            );
        } catch (e) {
            console.warn("Failed to record promoter conversion:", e.message);
        }
    }

    return { ...order, ...updates };
}
/**
 * Get comprehensive guestlist for an event
 * Aggregates claimed tickets (identities) and pending slots
 */
export async function getEventGuestlist(eventId) {
    if (!eventId) return [];

    if (!isFirebaseConfigured()) {
        // Mock fallback logic
        const orders = [...fallbackOrders, ...fallbackRSVPs].filter(o => o.eventId === eventId);
        return orders.map(o => ({
            id: o.id,
            name: o.userName,
            email: o.userEmail,
            ticketName: o.tickets[0]?.name,
            status: "confirmed",
            type: o.isRSVP ? "RSVP" : "Paid"
        }));
    }

    const db = getAdminDb();

    // 1. Fetch all assignments (Claimed Identities)
    const assignmentsSnapshot = await db.collection("ticket_assignments")
        .where("eventId", "==", eventId)
        .get();

    const claimed = assignmentsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            name: data.userName || "Guest", // Need to join with user profile if missing
            userId: data.redeemerId,
            ticketId: data.tierId,
            orderId: data.orderId,
            status: data.status === "used" ? "checked_in" : "confirmed",
            claimedAt: data.claimedAt,
            gender: data.requiredGender,
            type: "identity"
        };
    });

    // 2. Fetch all share bundles (to find pending slots)
    const bundlesSnapshot = await db.collection("share_bundles")
        .where("eventId", "==", eventId)
        .get();

    const pending = [];
    bundlesSnapshot.forEach(doc => {
        const bundle = doc.data();
        if (bundle.status === "active" || bundle.status === "exhausted") {
            const unclaimedSlots = (bundle.slots || []).filter(s => s.claimStatus === "unclaimed");
            unclaimedSlots.forEach(slot => {
                pending.push({
                    id: `PENDING-${doc.id}-${slot.slotIndex}`,
                    name: "Claim Pending",
                    ticketId: bundle.tierId,
                    orderId: bundle.orderId,
                    status: "pending",
                    gender: slot.requiredGender,
                    type: "placeholder"
                });
            });
        }
    });

    // 3. Fetch RSVP orders (Separated collection)
    const rsvpsSnapshot = await db.collection("rsvp_orders")
        .where("eventId", "==", eventId)
        .get();

    const rsvps = rsvpsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            name: data.userName,
            userId: data.userId,
            ticketId: data.tickets[0]?.ticketId,
            orderId: doc.id,
            status: "confirmed",
            claimedAt: data.confirmedAt,
            type: "rsvp"
        };
    });

    // 4. Join User Profiles for real names/identities
    const userIds = [...new Set([
        ...claimed.map(c => c.userId),
        ...rsvps.map(r => r.userId)
    ])].filter(Boolean);

    let profiles = {};
    if (userIds.length > 0) {
        // Batch fetch users (max 10 at a time for where-in)
        for (let i = 0; i < userIds.length; i += 10) {
            const batch = userIds.slice(i, i + 10);
            const usersSnapshot = await db.collection("users")
                .where("__name__", "in", batch)
                .get();
            usersSnapshot.forEach(udoc => {
                profiles[udoc.id] = udoc.data();
            });
        }
    }

    // Enhance claimed tickets with real names
    const enrichedClaimed = claimed.map(c => ({
        ...c,
        name: profiles[c.userId]?.name || c.name,
        email: profiles[c.userId]?.email,
        phone: profiles[c.userId]?.phone,
        avatar: profiles[c.userId]?.avatar
    }));

    // Enhance RSVPs
    const enrichedRsvps = rsvps.map(r => ({
        ...r,
        name: profiles[r.userId]?.name || r.name,
        email: profiles[r.userId]?.email,
        phone: profiles[r.userId]?.phone,
        avatar: profiles[r.userId]?.avatar
    }));

    // Combine all
    const guestlist = [...enrichedClaimed, ...enrichedRsvps, ...pending];

    // Sort by status and then time
    return guestlist.sort((a, b) => {
        if (a.status === b.status) return 0;
        if (a.status === "pending") return 1;
        if (b.status === "pending") return -1;
        return 0;
    });
}
