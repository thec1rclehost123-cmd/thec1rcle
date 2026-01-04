import { randomUUID } from "node:crypto";
import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";
import { getEvent } from "./eventStore";
import { sendTicketEmail } from "../email"; // Import email sender for delayed sending
import { getPromoterLinkByCode, recordConversion } from "./promoterStore";
import { generateOrderQRCodes } from "./qrStore";

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
 * Create an RSVP order (strictly for RSVP events)
 */
export async function createRSVPOrder(payload) {
    const {
        eventId,
        tickets,
        userId,
        userEmail,
        userName,
        promoterCode = null,
        reservationId = null // Track reservation for idempotency
    } = payload;

    const event = await getEvent(eventId);
    if (!event || !event.isRSVP) {
        throw new Error("Invalid event for RSVP");
    }

    // Check if an RSVP already exists for this reservation (Idempotency)
    if (reservationId) {
        const existingOrder = await getOrderByReservationId(reservationId);
        if (existingOrder && existingOrder.isRSVP) {
            return existingOrder;
        }
    }

    // Hard Limit: 1 ticket per user across event
    const hasExisting = await checkExistingRSVP(eventId, { userId, email: userEmail });
    if (hasExisting) {
        throw new Error("User already has an RSVP for this event");
    }

    const orderId = reservationId ? `RSVP-${reservationId}` : generateOrderId("RSVP");
    const now = new Date().toISOString();

    const rsvpOrder = {
        id: orderId,
        reservationId: reservationId,
        eventId,
        eventTitle: event.title,
        eventImage: event.image,
        eventDate: event.date,
        eventTime: event.time,
        eventLocation: event.location,
        userId: userId || null,
        userEmail: userEmail || "",
        userName: userName || "",
        userPhone: payload.userPhone || "",
        promoterCode: promoterCode || null,
        tickets: tickets.map(t => ({ ...t, price: 0, subtotal: 0 })),
        totalAmount: 0,
        currency: "INR",
        paymentMethod: "free",
        status: "confirmed",
        isRSVP: true,
        createdAt: now,
        updatedAt: now,
        confirmedAt: now
    };

    // Generate QR codes with RSVP metadata
    rsvpOrder.qrCodes = generateOrderQRCodes(rsvpOrder, event);

    // Resolve promoter code if provided
    let promoterLinkId = null;
    if (promoterCode) {
        try {
            const link = await getPromoterLinkByCode(promoterCode);
            if (link) {
                promoterLinkId = link.id;
            }
        } catch (err) {
            console.error("[OrderStore] Failed to resolve promoter code for RSVP:", err);
        }
    }

    if (!isFirebaseConfigured()) {
        fallbackRSVPs.push(rsvpOrder);
        return rsvpOrder;
    }

    const db = getAdminDb();
    await db.collection(RSVP_COLLECTION).doc(orderId).set(rsvpOrder);

    // Record promoter conversion for RSVP
    if (promoterLinkId) {
        try {
            const firstTicket = rsvpOrder.tickets[0];
            await recordConversion(promoterLinkId, rsvpOrder.id, 0, firstTicket.ticketId);
            console.log(`[OrderStore] Promoter conversion recorded for RSVP ${rsvpOrder.id}`);
        } catch (err) {
            console.error("[OrderStore] Failed to record promoter RSVP conversion:", err);
        }
    }

    // Update event inventory (if applicable for RSVP)
    try {
        const eventRef = db.collection("events").doc(eventId);
        const eventDoc = await eventRef.get();
        if (eventDoc.exists) {
            const currentTickets = eventDoc.data().tickets || [];
            tickets.forEach(t => {
                const idx = currentTickets.findIndex(ct => ct.id === t.ticketId);
                if (idx !== -1) {
                    const remaining = (currentTickets[idx].remaining ?? currentTickets[idx].quantity) - t.quantity;
                    currentTickets[idx].remaining = Math.max(0, remaining);
                }
            });
            await eventRef.update({ tickets: currentTickets, updatedAt: now });
        }
    } catch (e) {
        console.warn("Failed to update RSVP inventory:", e);
    }

    return rsvpOrder;
}

/**
 * Create an order and update ticket inventory atomically
 */
export async function createOrder(payload) {
    const {
        eventId,
        tickets, // Array of { ticketId, quantity }
        userId,
        userEmail,
        userName,
        promoterCode = null,
        paymentMethod = "card",
        reservationId = null, // Track reservation for idempotency
    } = payload;

    // Validate tickets array
    if (!Array.isArray(tickets) || tickets.length === 0) {
        const error = new Error("Tickets must be a non-empty array");
        error.statusCode = 400;
        throw error;
    }

    // Check if an order already exists for this reservation (Idempotency)
    if (reservationId) {
        const existingOrder = await getOrderByReservationId(reservationId);
        if (existingOrder) {
            return existingOrder;
        }
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
            entryType: eventTicket.entryType || 'general'
        });

        ticketUpdates.push({
            ticketId: eventTicket.id,
            quantity: Number(quantity),
        });
    }

    // Resolve promoter code if provided
    let promoterLinkId = null;
    let promoterDiscount = 0; // Percentage discount for promoter-linked purchases
    if (promoterCode) {
        try {
            const link = await getPromoterLinkByCode(promoterCode);
            if (link) {
                promoterLinkId = link.id;
                promoterDiscount = link.promoterDiscount || 0; // Get discount percentage
            }
        } catch (err) {
            console.error("[OrderStore] Failed to resolve promoter code:", err);
        }
    }

    // Apply promoter discount if applicable
    let discountAmount = 0;
    if (promoterDiscount > 0) {
        const fullSubtotal = calculateOrderTotal(orderTickets);
        discountAmount = Math.round(fullSubtotal * (promoterDiscount / 100));
        // Apply discount proportionally to each ticket
        orderTickets.forEach(ticket => {
            const ticketDiscount = Math.round(ticket.subtotal * (promoterDiscount / 100));
            ticket.discount = ticketDiscount;
            ticket.finalPrice = ticket.subtotal - ticketDiscount;
        });
    }

    const subtotal = calculateOrderTotal(orderTickets);
    // Note: Total amount might be slightly different than pure subtotal - discount due to fees calculated in service
    // But here we use the provided payload total if available to ensure consistency
    const totalAmount = payload.totalAmount !== undefined ? payload.totalAmount : (subtotal - discountAmount);

    // Use reservationId as part of orderId to ensure deterministic creation
    const orderId = reservationId ? `ORD-${reservationId}` : generateOrderId();
    const now = new Date().toISOString();

    const order = {
        id: orderId,
        reservationId: reservationId,
        eventId,
        eventTitle: event.title,
        eventImage: event.image,
        eventDate: event.date,
        eventTime: event.time,
        eventLocation: event.location,
        userId: userId || null,
        userEmail: userEmail || "",
        userName: userName || "",
        userPhone: payload.userPhone || "",
        promoterCode: promoterCode || null,
        promoterLinkId: promoterLinkId || null,
        promoterDiscount: promoterDiscount || 0,
        discountAmount: discountAmount || 0,
        tickets: orderTickets,
        subtotal,
        totalAmount,
        currency: "INR",
        paymentMethod,
        status: totalAmount === 0 ? "confirmed" : "pending_payment", // Auto-confirm free tickets IN PAID FLOW
        isRSVP: false, // This is a paid event order (even if total is 0)
        qrCodes: null, // Will be populated after confirmation
        createdAt: now,
        updatedAt: now,
    };

    // Generate QR codes if order is auto-confirmed (free tickets)
    if (order.status === "confirmed") {
        order.qrCodes = generateOrderQRCodes(order, event);
    }

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

        // If the order is confirmed (e.g., free tickets), record the promoter conversion immediately
        if (order.status === "confirmed" && promoterLinkId) {
            try {
                // For simplicity, we record conversion for the first ticket tier in the order
                const firstTicket = order.tickets[0];
                await recordConversion(promoterLinkId, order.id, order.totalAmount, firstTicket.ticketId);
                console.log(`[OrderStore] Promoter conversion recorded for order ${order.id}`);
            } catch (err) {
                console.error("[OrderStore] Failed to record promoter conversion:", err);
            }
        }

        return order;
    } catch (error) {
        console.error("Transaction failed:", error);
        throw error;
    }
}

/**
 * Get order by ID (checks both collections)
 */
export async function getOrderById(orderId) {
    if (!orderId) return null;

    if (!isFirebaseConfigured()) {
        return fallbackOrders.find(o => o.id === orderId) || fallbackRSVPs.find(o => o.id === orderId) || null;
    }

    const db = getAdminDb();

    // Check Paid Orders first
    let doc = await db.collection(ORDERS_COLLECTION).doc(orderId).get();
    if (doc.exists) return mapOrderDocument(doc);

    // Then check RSVP Orders
    doc = await db.collection(RSVP_COLLECTION).doc(orderId).get();
    if (doc.exists) return mapOrderDocument(doc);

    return null;
}

/**
 * Get all orders for a specific user (unified view)
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

    // Fetch from both collections
    const [ordersSnapshot, rsvpsSnapshot] = await Promise.all([
        db.collection(ORDERS_COLLECTION).where("userId", "==", userId).limit(limit).get(),
        db.collection(RSVP_COLLECTION).where("userId", "==", userId).limit(limit).get()
    ]);

    const allOrders = [
        ...ordersSnapshot.docs.map(mapOrderDocument),
        ...rsvpsSnapshot.docs.map(mapOrderDocument)
    ];

    allOrders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return allOrders.slice(0, limit);
}

/**
 * Check if a user already has an RSVP for a specific event
 * Used to enforce 1-ticket-per-user hard limit
 */
export async function checkExistingRSVP(eventId, { userId, email }) {
    if (!eventId || (!userId && !email)) return false;

    if (!isFirebaseConfigured()) {
        return fallbackRSVPs.some(o =>
            o.eventId === eventId &&
            o.status === "confirmed" &&
            ((userId && o.userId === userId) || (email && o.userEmail === email))
        );
    }

    const db = getAdminDb();

    // Check by userId if available
    if (userId) {
        const userSnapshot = await db.collection(RSVP_COLLECTION)
            .where("eventId", "==", eventId)
            .where("userId", "==", userId)
            .where("status", "==", "confirmed")
            .limit(1)
            .get();

        if (!userSnapshot.empty) return true;
    }

    // Check by email to block duplicates across sessions/devices
    if (email) {
        const emailSnapshot = await db.collection(RSVP_COLLECTION)
            .where("eventId", "==", eventId)
            .where("userEmail", "==", email)
            .where("status", "==", "confirmed")
            .limit(1)
            .get();

        if (!emailSnapshot.empty) return true;
    }

    return false;
}

/**
 * Get order by reservation ID
 * Used for idempotency to check if an order already exists for a reservation
 */
export async function getOrderByReservationId(reservationId) {
    if (!reservationId) return null;

    if (!isFirebaseConfigured()) {
        return (fallbackOrders || []).find(o => o.reservationId === reservationId) ||
            (fallbackRSVPs || []).find(o => o.reservationId === reservationId) || null;
    }

    const db = getAdminDb();

    // Check Paid Orders first
    const ordersSnapshot = await db.collection(ORDERS_COLLECTION)
        .where("reservationId", "==", reservationId)
        .limit(1)
        .get();

    if (!ordersSnapshot.empty) {
        const doc = ordersSnapshot.docs[0];
        return { id: doc.id, ...doc.data() };
    }

    // Then check RSVP Orders
    const rsvpsSnapshot = await db.collection(RSVP_COLLECTION)
        .where("reservationId", "==", reservationId)
        .limit(1)
        .get();

    if (!rsvpsSnapshot.empty) {
        const doc = rsvpsSnapshot.docs[0];
        return { id: doc.id, ...doc.data() };
    }

    return null;
}

/**
 * Get all orders for a specific event
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
        db.collection(ORDERS_COLLECTION).where("eventId", "==", eventId).limit(limit).get(),
        db.collection(RSVP_COLLECTION).where("eventId", "==", eventId).limit(limit).get()
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

    // Recalculate total orders based on confirmed paid orders only
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

    if (!isFirebaseConfigured()) {
        const index = fallbackOrders.findIndex(o => o.id === orderId);
        if (index >= 0) {
            fallbackOrders[index] = { ...fallbackOrders[index], ...updates };

            // If confirming, trigger email logic (simulated here, usually handled by caller)
            if (status === "confirmed" && order.status !== "confirmed") {
                console.log(`[OrderStore] Order ${orderId} confirmed via update.`);
            }

            return fallbackOrders[index];
        }
    }

    const db = getAdminDb();
    await db.collection(ORDERS_COLLECTION).doc(orderId).update(updates);

    return { ...order, ...updates };
}

/**
 * Confirm an order after successful payment
 * Generates QR codes and handles promoter conversion
 */
export async function confirmOrder(orderId, paymentDetails = {}) {
    const order = await getOrderById(orderId);
    if (!order) throw new Error("Order not found");

    if (order.status === "confirmed") {
        return order; // Already confirmed
    }

    const event = await getEvent(order.eventId);
    const now = new Date().toISOString();

    // Generate QR codes for the order
    const qrCodes = generateOrderQRCodes(order, event);

    const updates = {
        status: "confirmed",
        qrCodes,
        confirmedAt: now,
        updatedAt: now,
        paymentDetails: {
            ...order.paymentDetails,
            ...paymentDetails,
            paidAt: now
        }
    };

    if (!isFirebaseConfigured()) {
        const index = fallbackOrders.findIndex(o => o.id === orderId);
        if (index >= 0) {
            fallbackOrders[index] = { ...fallbackOrders[index], ...updates };

            // Handle promoter conversion
            if (order.promoterLinkId) {
                try {
                    const firstTicket = order.tickets[0];
                    await recordConversion(order.promoterLinkId, orderId, order.totalAmount, firstTicket.ticketId);
                    console.log(`[OrderStore] Promoter conversion recorded for confirmed order ${orderId}`);
                } catch (err) {
                    console.error("[OrderStore] Failed to record promoter conversion:", err);
                }
            }

            return fallbackOrders[index];
        }
    }

    const db = getAdminDb();
    await db.collection(ORDERS_COLLECTION).doc(orderId).update(updates);

    // Handle promoter conversion
    if (order.promoterLinkId) {
        try {
            const firstTicket = order.tickets[0];
            await recordConversion(order.promoterLinkId, orderId, order.totalAmount, firstTicket.ticketId);
            console.log(`[OrderStore] Promoter conversion recorded for confirmed order ${orderId}`);
        } catch (err) {
            console.error("[OrderStore] Failed to record promoter conversion:", err);
        }
    }

    // Send ticket notification (async, don't await)
    try {
        const { notifyTicketPurchase } = require("./notificationStore");
        notifyTicketPurchase({ ...order, ...updates }).catch(err =>
            console.error("[OrderStore] Failed to send ticket notification:", err)
        );
    } catch (err) {
        console.warn("[OrderStore] Notification module not available:", err.message);
    }

    return { ...order, ...updates };
}
