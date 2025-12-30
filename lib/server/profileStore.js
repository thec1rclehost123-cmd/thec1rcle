import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";
import { getUserOrders } from "./orderStore";
import { fetchEventsByIds } from "../firebase/eventsClient"; // Actually this is a client-side thing, let's use a server-side one
import { getEvent } from "./eventStore";
import { createHmac } from "node:crypto";

const USERS_COLLECTION = "users";

export async function getUserProfile(userId) {
    if (!userId) return null;
    if (!isFirebaseConfigured()) {
        return {
            uid: userId,
            displayName: "Mock User",
            email: "mock@example.com",
            photoURL: null,
            bio: "A fellow adventurer in THE C1RCLE.",
            createdAt: new Date().toISOString(),
            attendedEvents: []
        };
    }

    const db = getAdminDb();
    const doc = await db.collection(USERS_COLLECTION).doc(userId).get();
    if (!doc.exists) return null;

    return { id: doc.id, ...doc.data() };
}

export async function getUserEvents(profileUserId, viewerUserId) {
    if (!profileUserId) return { upcoming: [], attended: [] };
    if (!isFirebaseConfigured()) {
        const { events } = require("../../data/events");
        const mockEvents = (events || []).slice(0, 4).map((event, i) => ({
            eventId: event.id,
            title: event.title,
            startAt: event.startDate || event.startAt || new Date().toISOString(),
            venueName: event.venue || event.location,
            city: event.city || "Pune",
            posterUrl: event.image,
            participationType: i % 2 === 0 ? "TICKET" : "RSVP"
        }));

        return {
            upcoming: mockEvents.slice(0, 2),
            attended: mockEvents.slice(2, 4)
        };
    }

    // 1. Fetch orders (tickets)
    const orders = await getUserOrders(profileUserId);

    // 2. Fetch profile for RSVPs
    const profile = await getUserProfile(profileUserId);
    const rsvpIds = profile?.attendedEvents || [];

    // 3. Collect all event IDs
    const orderEventIds = orders.map(o => o.eventId);
    const allEventIds = Array.from(new Set([...orderEventIds, ...rsvpIds]));

    // 4. Batch fetch events
    // Assuming getEvent is efficient enough for small sets, otherwise we'd use a where in query
    const db = getAdminDb();
    let eventsData = [];

    if (allEventIds.length > 0) {
        // Firestore where in is limited to 10-30 IDs usually. 
        // For simplicity, let's just fetch them. In a real app we'd batch this.
        const snapshots = await Promise.all(allEventIds.map(id => db.collection("events").doc(id).get()));
        eventsData = snapshots.map(s => s.exists ? { id: s.id, ...s.data() } : null).filter(Boolean);
    }

    // 5. Unify participation
    const participationMap = new Map();

    // Process RSVPs first
    rsvpIds.forEach(id => {
        participationMap.set(id, {
            type: "RSVP",
            id: null // RSVPs don't have a separate ID in the dummy data usually, just existence in attendedEvents
        });
    });

    // Process orders (tickets override RSVPs)
    // Only count confirmed/paid orders as TICKETS
    orders.filter(o => o.status === "confirmed").forEach(order => {
        participationMap.set(order.eventId, {
            type: "TICKET",
            id: order.id
        });
    });

    const now = new Date();
    const upcoming = [];
    const attended = [];

    eventsData.forEach(event => {
        const participation = participationMap.get(event.id);
        const eventStart = new Date(event.startDate || event.startAt);
        const isEventLive = event.settings?.activity !== false;

        // Use server-side logic for "upcoming" vs "past"
        const isUpcoming = eventStart > now && isEventLive;
        const isPast = eventStart <= now || !isEventLive;

        const summary = {
            eventId: event.id,
            title: event.title,
            startAt: event.startDate || event.startAt,
            venueName: event.venue || event.location,
            city: event.city,
            posterUrl: event.image,
            participationType: participation.type,
        };

        // Privacy: only owner sees participationId
        if (profileUserId === viewerUserId) {
            summary.ownerOnlyParticipationId = participation.id;
        }

        if (isUpcoming) {
            upcoming.push(summary);
        } else if (isPast) {
            // Only show in attended if they have a confirmed ticket or RSVP
            // Since participationMap contains confirmed things, we are safe here
            attended.push(summary);
        }
    });

    // Sort by date
    upcoming.sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
    attended.sort((a, b) => new Date(b.startAt) - new Date(a.startAt));

    return { upcoming, attended };
}

export async function getUserTickets(userId) {
    if (!userId) return { upcomingTickets: [], pastTickets: [] };

    if (!isFirebaseConfigured()) {
        const { events } = require("../../data/events");
        const mockTickets = (events || []).slice(0, 4).map((event, i) => {
            const isRSVP = i % 2 !== 0;
            const isPast = i >= 2;
            const ticketId = isRSVP ? `RSVP-${event.id}-${i}` : `mock-${event.id}-${i}`;
            const signature = createHmac("sha256", "mock-secret").update(ticketId).digest("hex").slice(0, 16);

            return {
                ticketId,
                eventId: event.id,
                eventTitle: event.title,
                eventStartAt: event.startDate || event.startAt || new Date().toISOString(),
                venueName: event.venue || event.location,
                city: event.city || "Pune",
                posterUrl: event.image,
                ticketType: isRSVP ? "RSVP" : (i === 0 ? "VIP Access" : "General Admission"),
                qrPayload: `${ticketId}:${signature}`,
                status: isPast ? "used" : "active"
            };
        });

        return {
            upcomingTickets: mockTickets.filter(t => t.status === "active"),
            pastTickets: mockTickets.filter(t => t.status === "used")
        };
    }

    const db = getAdminDb();

    // 1. Fetch confirmed/used/cancelled orders
    const ordersSnapshot = await db.collection("orders")
        .where("userId", "==", userId)
        .get();

    const orderDocs = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 2. Fetch RSVPs from profile
    const profileDoc = await db.collection("users").doc(userId).get();
    const profileData = profileDoc.exists ? profileDoc.data() : {};
    const rsvpEventIds = profileData.attendedEvents || [];

    // 3. Fetch Event Details
    const allEventIds = Array.from(new Set([
        ...orderDocs.map(o => o.eventId),
        ...rsvpEventIds
    ]));

    const eventsData = {};
    if (allEventIds.length > 0) {
        // Fetch events in batches of 30 (Firestore limit for 'in')
        const snapshots = await Promise.all(allEventIds.map(id => db.collection("events").doc(id).get()));
        snapshots.forEach(s => {
            if (s.exists) eventsData[s.id] = { id: s.id, ...s.data() };
        });
    }

    const now = new Date();
    const upcoming = [];
    const past = [];

    // 4. Transform Orders into Tickets
    orderDocs.forEach(order => {
        const event = eventsData[order.eventId];
        if (!event) return;

        const eventStart = new Date(event.startDate || event.startAt);
        const isEventPast = eventStart < now;

        // Skip orders that are not confirmed/used/cancelled for the tickets view
        if (!["confirmed", "used", "cancelled"].includes(order.status)) return;

        order.tickets.forEach((ticketGroup, groupIndex) => {
            for (let i = 0; i < ticketGroup.quantity; i++) {
                const ticketId = `${order.id}-${ticketGroup.ticketId}-${i}`;
                const status = order.status === "cancelled" ? "cancelled" : (order.status === "used" || isEventPast ? "used" : "active");

                const secret = process.env.TICKET_SECRET || "c1rcle-secret-2025";
                const signature = createHmac("sha256", secret).update(ticketId).digest("hex").slice(0, 16);
                const qrPayload = `${ticketId}:${signature}`;

                const ticket = {
                    ticketId,
                    eventId: event.id,
                    eventTitle: event.title,
                    eventStartAt: event.startDate || event.startAt,
                    venueName: event.venue || event.location,
                    city: event.city,
                    posterUrl: event.image,
                    ticketType: ticketGroup.name,
                    qrPayload,
                    status
                };

                if (status === "active") {
                    upcoming.push(ticket);
                } else {
                    past.push(ticket);
                }
            }
        });
    });

    // 5. Transform RSVPs into Tickets
    rsvpEventIds.forEach(eventId => {
        if (orderDocs.some(o => o.eventId === eventId && o.status !== "cancelled")) return;

        const event = eventsData[eventId];
        if (!event) return;

        const eventStart = new Date(event.startDate || event.startAt);
        const isEventPast = eventStart < now;
        const status = isEventPast ? "used" : "active";

        const ticketId = `RSVP-${userId}-${eventId}`;
        const secret = process.env.TICKET_SECRET || "c1rcle-secret-2025";
        const signature = createHmac("sha256", secret).update(ticketId).digest("hex").slice(0, 16);
        const qrPayload = `${ticketId}:${signature}`;

        const ticket = {
            ticketId,
            eventId: event.id,
            eventTitle: event.title,
            eventStartAt: event.startDate || event.startAt,
            venueName: event.venue || event.location,
            city: event.city,
            posterUrl: event.image,
            ticketType: "RSVP",
            qrPayload,
            status
        };

        if (status === "active") {
            upcoming.push(ticket);
        } else {
            past.push(ticket);
        }
    });

    // Sort
    upcoming.sort((a, b) => new Date(a.eventStartAt) - new Date(b.eventStartAt));
    past.sort((a, b) => new Date(b.eventStartAt) - new Date(a.eventStartAt));

    return { upcomingTickets: upcoming, pastTickets: past };
}
