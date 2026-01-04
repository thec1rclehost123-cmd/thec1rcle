import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";
import { getUserOrders } from "./orderStore";
import { fetchEventsByIds } from "../firebase/eventsClient"; // Actually this is a client-side thing, let's use a server-side one
import { getEvent } from "./eventStore";
import { createHmac } from "node:crypto";
import { getUserClaimedTickets, getOrderShareBundles, getOrderAssignments, getCoupleAssignment, getPendingTransfers } from "./ticketShareStore";

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

    const data = doc.data();

    // Normalize timestamps for client serialization
    Object.keys(data).forEach(key => {
        if (data[key] && typeof data[key].toDate === 'function') {
            data[key] = data[key].toDate().toISOString();
        }
    });

    return { id: doc.id, ...data };
}

export async function findUserByEmail(email) {
    if (!isFirebaseConfigured()) return null;
    const db = getAdminDb();
    const snapshot = await db.collection(USERS_COLLECTION).where("email", "==", email).limit(1).get();
    if (snapshot.empty) return null;
    return { uid: snapshot.docs[0].id, ...snapshot.docs[0].data() };
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
    if (!userId) return { upcoming: [], past: [], actionNeeded: [], cancelled: [] };

    const userProfile = await getUserProfile(userId);
    const userGender = userProfile?.gender || "any";
    const userEmail = userProfile?.email;

    if (!isFirebaseConfigured()) {
        const { events } = require("../../data/events");
        const mockTickets = (events || []).slice(0, 4).map((event, i) => {
            const isRSVP = i % 2 !== 0;
            const isPast = i >= 2;
            const ticketId = isRSVP ? `RSVP-${event.id}-${i}` : `mock-${event.id}-${i}`;
            const secret = process.env.TICKET_SECRET || "c1rcle-secret-2025";
            const signature = createHmac("sha256", secret).update(ticketId).digest("hex").slice(0, 16);

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
            pastTickets: mockTickets.filter(t => t.status === "used"),
            actionNeeded: [],
            cancelledTickets: []
        };
    }

    const db = getAdminDb();

    // 1. Fetch ALL orders for this user
    const ordersSnapshot = await db.collection("orders")
        .where("userId", "==", userId)
        .get();

    const orderDocs = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // 2. Fetch RSVPs from profile
    const rsvpEventIds = userProfile?.attendedEvents || [];

    // 3. Fetch Claimed Tickets (from other people's shares or transfers)
    const claimedTickets = await getUserClaimedTickets(userId);

    // 4. Fetch Pending Transfers (Sent or Received)
    const transfers = userEmail ? await getPendingTransfers(userId, userEmail) : [];
    const pendingSentTicketIds = transfers.filter(t => t.isSender).map(t => t.ticketId);

    // 5. Fetch Couple Assignments
    const partnerAssignmentsSnapshot = await db.collection("couple_assignments")
        .where("partnerId", "==", userId)
        .get();
    const partnerAssignments = partnerAssignmentsSnapshot.docs.map(doc => ({ ticketId: doc.id, ...doc.data() }));

    const ownerAssignmentsSnapshot = await db.collection("couple_assignments")
        .where("ownerId", "==", userId)
        .get();
    const ownerAssignmentsMap = {};
    ownerAssignmentsSnapshot.docs.forEach(doc => {
        ownerAssignmentsMap[doc.id] = doc.data();
    });

    // 6. Collect all event IDs
    const allEventIds = Array.from(new Set([
        ...orderDocs.map(o => o.eventId),
        ...rsvpEventIds,
        ...claimedTickets.map(t => t.eventId),
        ...partnerAssignments.map(t => t.eventId),
        ...transfers.map(t => t.eventId)
    ].filter(Boolean)));

    const eventsData = {};
    if (allEventIds.length > 0) {
        const snapshots = await Promise.all(allEventIds.map(id => db.collection("events").doc(id).get()));
        snapshots.forEach(s => {
            if (s.exists) eventsData[s.id] = { id: s.id, ...s.data() };
        });
    }

    const now = new Date();
    const upcoming = [];
    const past = [];
    const actionNeeded = [];
    const cancelled = [];

    // 7. Get share bundles and assignments for skipping/tagging shared tickets
    const shareBundlesMap = {};
    await Promise.all(orderDocs.map(async (order) => {
        const [bundles, assignments] = await Promise.all([
            getOrderShareBundles(order.id),
            getOrderAssignments(order.id)
        ]);
        const totalShared = bundles.reduce((sum, b) => b.status !== "cancelled" ? sum + b.totalSlots : sum, 0);
        const totalClaimed = assignments.filter(a => a.bundleId).length; // Only bundle claims
        shareBundlesMap[order.id] = { totalShared, totalClaimed, bundles, assignments };
    }));

    // 8. Fetch scans
    const allTicketIdsToCheck = [];
    orderDocs.forEach(order => {
        order.tickets?.forEach(tg => {
            for (let i = 0; i < tg.quantity; i++) allTicketIdsToCheck.push(`${order.id}-${tg.ticketId}-${i}`);
        });
    });

    const scansMap = {};
    if (allTicketIdsToCheck.length > 0) {
        const chunks = [];
        for (let i = 0; i < allTicketIdsToCheck.length; i += 30) chunks.push(allTicketIdsToCheck.slice(i, i + 30));
        await Promise.all(chunks.map(async chunk => {
            const snap = await Promise.all(chunk.map(id => db.collection("ticket_scans").doc(id).get()));
            snap.forEach(s => { if (s.exists) scansMap[s.id] = s.data(); });
        }));
    }

    // 9. Process Orders
    orderDocs.forEach(order => {
        const event = eventsData[order.eventId];
        if (!event) return;

        const eventStart = new Date(event.startDate || event.startAt);
        const isEventPast = eventStart < now;

        // A. Handle Pending Payment
        if (order.status === "pending_payment") {
            actionNeeded.push({
                type: "order",
                id: order.id,
                eventId: event.id,
                eventTitle: event.title,
                eventStartAt: event.startDate || event.startAt,
                posterUrl: event.image,
                reason: "Payment Pending",
                amount: order.totalAmount,
                status: "pending_payment"
            });
            return;
        }

        // B. Handle Cancelled/Refunded Orders
        if (order.status === "cancelled" || order.status === "refunded") {
            cancelled.push({
                type: "order",
                id: order.id,
                eventId: event.id,
                eventTitle: event.title,
                eventStartAt: event.startDate || event.startAt,
                posterUrl: event.image,
                status: order.status,
                totalAmount: order.totalAmount
            });
            return;
        }

        // C. Process Confirmed Tickets
        if (order.status === "confirmed" || order.status === "used") {
            const { bundles = [], totalClaimed = 0 } = shareBundlesMap[order.id] || {};

            order.tickets?.forEach(ticketGroup => {
                const tierId = ticketGroup.ticketId;
                const isCouple = ticketGroup.name.toLowerCase().includes("couple");

                // Find if there's a bundle for this specific tier
                const bundle = bundles.find(b => b.tierId === tierId);

                // If we have a bundle, use its slot logic
                // If not, we treat it as a virtual bundle for now
                const totalTickets = ticketGroup.quantity;
                const claimedCount = bundle ? (bundle.totalSlots - bundle.remainingSlots - 1) : 0; // -1 for owner
                const availableToShare = totalTickets - claimedCount - 1; // -1 for owner

                const ticketId = `${order.id}-${tierId}-0`; // Slot 1 is always index 0 internally here? 
                // Wait, let's use a consistent ID format for Slot 1
                const ownerTicketId = `${order.id}-${tierId}-owner`;

                // Handle transfers for owner's slot
                const isTransferPending = pendingSentTicketIds.includes(ownerTicketId) || pendingSentTicketIds.includes(`${order.id}-${tierId}-0`);

                // Fetch couple assignment for the owner's slot
                const assignment = ownerAssignmentsMap[ownerTicketId] || ownerAssignmentsMap[`${order.id}-${tierId}-0`];

                // Check if this specific ticket (Slot 1 / Owner Slot) has been transferred OUT
                // We find an assignment for this ticketId where redeemerId != current user
                const isTransferredOut = (shareBundlesMap[order.id]?.assignments || []).some(a =>
                    (a.originalTicketId === ownerTicketId || a.originalTicketId === `${order.id}-${tierId}-0`) &&
                    a.redeemerId !== userId
                );

                if (isTransferredOut) return;

                const tier = event.tickets?.find(t => t.id === tierId);
                const requiredGender = tier?.requiredGender || (isCouple ? "male" : (tier?.genderRequirement || "any"));
                const genderMismatch = (requiredGender !== "any" && requiredGender !== userGender);

                const ticket = {
                    ticketId: ownerTicketId,
                    orderId: order.id,
                    eventId: event.id,
                    tierId,
                    eventTitle: event.title,
                    eventStartAt: event.startDate || event.startAt,
                    venueName: event.venue || event.location,
                    city: event.city,
                    posterUrl: event.image,
                    ticketType: ticketGroup.name,
                    status: "active",
                    isCouple,
                    requiredGender,
                    genderMismatch,
                    isTransferPending,
                    isBundle: totalTickets > 1,
                    totalSlots: totalTickets,
                    heldSlots: 1,
                    shareableSlots: totalTickets - 1,
                    claimedSlots: claimedCount,
                    remainingToShare: availableToShare,
                    bundleId: bundle?.id,
                    mode: bundle?.mode || "individual",
                    scansRemaining: bundle?.scanCreditsRemaining ?? totalTickets,
                    shareToken: bundle?.token,
                    coupleAssignment: isCouple ? (assignment || { status: 'unassigned', ownerId: userId }) : null,
                    orderType: order.totalAmount === 0 ? "₹0 Checkout" : "Paid"
                };

                const scan = scansMap[`${order.id}-${tierId}-0`] || scansMap[ownerTicketId];
                if (scan || order.status === "used") {
                    ticket.status = "used";
                    ticket.scannedAt = scan?.scannedAt || order.updatedAt;
                    past.push(ticket);
                } else if (isEventPast) {
                    ticket.status = "used";
                    past.push(ticket);
                } else {
                    // Secret for QR (Owner's QR)
                    const secret = process.env.TICKET_SECRET || "c1rcle-secret-2025";
                    const signature = createHmac("sha256", secret).update(ownerTicketId).digest("hex").slice(0, 16);

                    // CRITICAL: Only provide QR if gender matches
                    const canViewQR = !isTransferPending && !genderMismatch;

                    if (bundle?.mode === "shared_qr") {
                        ticket.qrPayload = canViewQR ? bundle.groupQrPayload : null;
                        ticket.isSharedQr = true;
                    } else {
                        ticket.qrPayload = canViewQR ? `${ownerTicketId}:${signature}` : null;
                    }

                    upcoming.push(ticket);
                }
            });
        }
    });

    // 10. Process Claimed/Transferred Tickets
    claimedTickets.forEach(claim => {
        const event = eventsData[claim.eventId];
        if (!event) return;

        const eventStart = new Date(event.startDate || event.startAt);
        const isEventPast = eventStart < now;

        const requiredGender = claim.requiredGender || "any";
        const genderMismatch = (requiredGender !== "any" && requiredGender !== userGender);

        const ticket = {
            ticketId: claim.assignmentId,
            orderId: claim.orderId,
            eventId: event.id,
            eventTitle: event.title,
            eventStartAt: event.startDate || event.startAt,
            venueName: event.venue || event.location,
            city: event.city,
            posterUrl: event.image,
            ticketType: claim.isSharedQr ? "Shared Group Pass" : (claim.originalTicketId ? "Transferred Pass" : "Shared Pass"),
            status: claim.status === "used" || isEventPast ? "used" : "active",
            isClaimed: true,
            isSharedQr: claim.isSharedQr,
            requiredGender,
            genderMismatch,
            couplePairId: claim.couplePairId || null,
            qrPayload: (genderMismatch || claim.status === "used" || isEventPast) ? null : claim.qrPayload,
            orderType: "Paid"
        };

        if (ticket.status === "active") {
            upcoming.push(ticket);
        } else {
            past.push(ticket);
        }
    });

    // 11. Process Partner Assignments
    partnerAssignments.forEach(assignment => {
        const event = eventsData[assignment.eventId];
        if (!event) return;

        const eventStart = new Date(event.startDate || event.startAt);
        const isEventPast = eventStart < now;

        const ticketId = assignment.ticketId;
        const isScanned = !!scansMap[ticketId];
        const status = isScanned || isEventPast ? "used" : "active";

        const secret = process.env.TICKET_SECRET || "c1rcle-secret-2025";
        const signature = createHmac("sha256", secret).update(ticketId).digest("hex").slice(0, 16);

        const ticket = {
            ticketId,
            eventId: event.id,
            eventTitle: event.title,
            eventStartAt: event.startDate || event.startAt,
            venueName: event.venue || event.location,
            city: event.city,
            posterUrl: event.image,
            ticketType: "Couple Pass (Female)", // Couple partners are usually the female slot
            status,
            isCouplePartner: true,
            requiredGender: "female",
            genderMismatch: userGender !== "female",
            qrPayload: (status === "active" && userGender === "female") ? `${ticketId}:${signature}` : null,
            orderType: "Paid",
            coupleAssignment: assignment
        };

        if (status === "active") upcoming.push(ticket);
        else past.push(ticket);
    });

    // 12. Process RSVPs
    rsvpEventIds.forEach(eventId => {
        // Skip if they have a real ticket for the same event
        if (upcoming.some(t => t.eventId === eventId) || past.some(t => t.eventId === eventId)) return;

        const event = eventsData[eventId];
        if (!event) return;

        const eventStart = new Date(event.startDate || event.startAt);
        const isEventPast = eventStart < now;
        const status = isEventPast ? "used" : "active";

        const ticketId = `RSVP-${userId}-${eventId}`;
        const secret = process.env.TICKET_SECRET || "c1rcle-secret-2025";
        const signature = createHmac("sha256", secret).update(ticketId).digest("hex").slice(0, 16);

        const ticket = {
            ticketId,
            eventId: event.id,
            eventTitle: event.title,
            eventStartAt: event.startDate || event.startAt,
            venueName: event.venue || event.location,
            city: event.city,
            posterUrl: event.image,
            ticketType: "RSVP",
            qrPayload: status === "active" ? `${ticketId}:${signature}` : null,
            status,
            orderType: "RSVP"
        };

        if (status === "active") upcoming.push(ticket);
        else past.push(ticket);
    });

    // 13. Process Pending Transfers for recipient
    transfers.filter(t => !t.isSender).forEach(transfer => {
        const event = eventsData[transfer.eventId];
        actionNeeded.push({
            type: "transfer",
            id: transfer.id,
            transfer,
            eventId: transfer.eventId,
            eventTitle: event?.title || "Unknown Event",
            eventStartAt: event?.startDate || event?.startAt,
            posterUrl: event?.image,
            reason: "Incoming Transfer",
            status: "pending"
        });
    });

    // Sort
    upcoming.sort((a, b) => new Date(a.eventStartAt) - new Date(b.eventStartAt));
    past.sort((a, b) => new Date(b.eventStartAt) - new Date(a.eventStartAt));

    return {
        upcomingTickets: upcoming,
        pastTickets: past,
        actionNeeded,
        cancelledTickets: cancelled,
        shareBundles: shareBundlesMap
    };
}
