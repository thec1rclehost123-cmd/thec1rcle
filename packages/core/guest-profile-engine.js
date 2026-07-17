import { getAdminDb, getAdminApp } from '@c1rcle/core/admin';
import { getAuth } from 'firebase-admin/auth';
import { createHmac } from 'node:crypto';
import { cacheGet, cacheSet, cacheDel } from '@c1rcle/core/redis';
import { getTicketSecret } from './secret-registry.js';
import { getEventTimestamps } from './time.js';

function isFirebaseConfigured() {
  return true;
}

const USERS_COLLECTION = 'users';

function getPreferredProfilePhoto(data = {}) {
  if (typeof data.photoURL === 'string' && data.photoURL.trim()) return data.photoURL.trim();
  if (typeof data.avatar === 'string' && data.avatar.trim()) return data.avatar.trim();
  if (Array.isArray(data.photos)) {
    const galleryPhoto = data.photos.find((entry) => typeof entry === 'string' && entry.trim());
    if (galleryPhoto) return galleryPhoto.trim();
  }
  if (typeof data.selfiePhoto === 'string' && data.selfiePhoto.trim())
    return data.selfiePhoto.trim();
  return null;
}

export async function getUserProfile(userId, viewerUserId = null, isMatch = false) {
  if (!userId) return null;

  const db = getAdminDb();
  const doc = await db.collection(USERS_COLLECTION).doc(userId).get();

  let data = doc.exists ? doc.data() : {};

  let photoURL = getPreferredProfilePhoto(data);

  // Hybrid fetch: if Firestore is missing photo, check Firebase Auth (3s timeout)
  if (!photoURL) {
    try {
      const auth = getAuth(getAdminApp());
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 3000),
      );
      const userRecord = await Promise.race([auth.getUser(userId), timeout]);
      if (userRecord.photoURL) {
        data.photoURL = userRecord.photoURL;
        // Fire-and-forget sync back
        db.collection(USERS_COLLECTION)
          .doc(userId)
          .update({ photoURL: userRecord.photoURL, avatar: userRecord.photoURL })
          .catch(() => {});
        photoURL = userRecord.photoURL;
      }
    } catch (e) {
      if (e.message !== 'timeout')
        console.warn(`[ProfileStore] Auth fallback failed for ${userId}:`, e.message);
    }
  }

  // Normalize timestamps for client serialization
  Object.keys(data).forEach((key) => {
    if (data[key] && typeof data[key].toDate === 'function') {
      data[key] = data[key].toDate().toISOString();
    }
  });

  const isSelf = viewerUserId === userId;
  const profile = {
    id: doc.id,
    ...data,
    photoURL,
    avatar: photoURL,
  };

  // 🛡️ Phase 6: Privacy Shield (Ghost Profile Pattern)
  // Redact PII if viewer is not the owner AND not a mutual match
  if (!isSelf && !isMatch) {
    return {
      id: profile.id,
      displayName: 'Ghost Attendee', // Anonymous placeholder
      photoURL: null,
      avatar: null,
      bio: 'Identity hidden until mutual match.',
      isAnonymous: true,
      // Keep public badges/stats if any
      reputation: profile.reputation || 0,
      interests: profile.interests || [],
      attendedEvents: (profile.attendedEvents || []).length, // Only return count
    };
  }

  return profile;
}

export async function findUserByEmail(email) {
  if (!isFirebaseConfigured()) return null;
  const db = getAdminDb();
  const snapshot = await db.collection(USERS_COLLECTION).where('email', '==', email).limit(1).get();
  if (snapshot.empty) return null;
  return { uid: snapshot.docs[0].id, ...snapshot.docs[0].data() };
}

export async function getUserEvents(profileUserId, viewerUserId) {
  if (!profileUserId) return { upcoming: [], attended: [] };
  if (!isFirebaseConfigured()) {
    const { events } = await import('../../data/events.js');
    const mockEvents = (events || []).slice(0, 4).map((event, i) => ({
      eventId: event.id,
      title: event.title,
      startAt: event.startDate || event.startAt || new Date().toISOString(),
      venueName: event.venue || event.location,
      city: event.city || 'Pune',
      posterUrl: event.image,
      participationType: i % 2 === 0 ? 'TICKET' : 'RSVP',
    }));

    return {
      upcoming: mockEvents.slice(0, 2),
      attended: mockEvents.slice(2, 4),
    };
  }

  const db = getAdminDb();

  // 1. Fetch orders (tickets)
  const { getUserOrders } = await import('@c1rcle/core/order-engine');
  const orders = await getUserOrders(profileUserId);

  // 2. Fetch profile for RSVPs and status
  const profile = await getUserProfile(profileUserId);
  const rsvpIds = profile?.attendedEvents || [];

  // 3. Collect all event IDs from participation
  const orderEventIds = orders.map((o) => o.eventId);
  const participationEventIds = Array.from(new Set([...orderEventIds, ...rsvpIds]));

  // 4. Also fetch events where user is HOST, VENUE, or CREATOR
  // We check for both their UID and any partner IDs they might have
  const membershipsSnapshot = await db
    .collection('partner_memberships')
    .where('uid', '==', profileUserId)
    .where('isActive', '==', true)
    .get();
  const partnerIds = membershipsSnapshot.docs.map((doc) => doc.data().partnerId).filter(Boolean);
  const allIdentities = Array.from(new Set([profileUserId, ...partnerIds]));

  // Batch fetch events using all identities
  // Firestore 'in' limit is 10, which is enough for almost all users
  const queryIdentities = allIdentities.slice(0, 10);

  const [hostedSnapshot, venueSnapshot, creatorSnapshot] = await Promise.all([
    db
      .collection('events')
      .where('hostId', 'in', queryIdentities)
      .where('isDeleted', '==', false)
      .get(),
    db
      .collection('events')
      .where('venueId', 'in', queryIdentities)
      .where('isDeleted', '==', false)
      .get(),
    db
      .collection('events')
      .where('creatorId', 'in', queryIdentities)
      .where('isDeleted', '==', false)
      .get(),
  ]);

  // Unify and deduplicate owned events
  const uniqueOwned = new Map();
  [...hostedSnapshot.docs, ...venueSnapshot.docs, ...creatorSnapshot.docs].forEach((doc) => {
    if (!uniqueOwned.has(doc.id)) {
      uniqueOwned.set(doc.id, { id: doc.id, ...doc.data() });
    }
  });
  const ownedEvents = Array.from(uniqueOwned.values());
  const ownedEventIds = ownedEvents.map((e) => e.id);

  // 5. Unify all event IDs
  const allEventIds = Array.from(new Set([...participationEventIds, ...ownedEventIds]));

  // 6. Batch fetch/prepare event data
  let eventsData = [];
  if (allEventIds.length > 0) {
    // Use ownedEvents we already have, and fetch the rest
    const alreadyFetched = new Map(uniqueOwned);
    const missingIds = allEventIds.filter((id) => !alreadyFetched.has(id));

    if (missingIds.length > 0) {
      const snapshots = await Promise.all(
        missingIds.map((id) => db.collection('events').doc(id).get()),
      );
      snapshots.forEach((s) => {
        if (s.exists) {
          alreadyFetched.set(s.id, { id: s.id, ...s.data() });
        }
      });
    }
    eventsData = Array.from(alreadyFetched.values());
  }

  // 7. Unify participation
  const participationMap = new Map();

  // Process RSVPs
  rsvpIds.forEach((id) => {
    participationMap.set(id, {
      type: 'RSVP',
      id: null,
    });
  });

  // Process orders (tickets override RSVPs)
  orders
    .filter((o) => o.status === 'confirmed')
    .forEach((order) => {
      participationMap.set(order.eventId, {
        type: 'TICKET',
        id: order.id,
      });
    });

  // Process OWNED events (HOST/VENUE/CREATOR override others)
  ownedEvents.forEach((event) => {
    participationMap.set(event.id, {
      type: 'HOST',
      id: event.id,
    });
  });

  const { PUBLIC_LIFECYCLE_STATES } = await import('@c1rcle/core/events');
  const now = new Date();
  const upcoming = [];
  const attended = [];

  eventsData.forEach((event) => {
    const participation = participationMap.get(event.id);
    const eventStart = new Date(event.startDate || event.startAt);
    const isEventLive = event.settings?.activity !== false;

    // Use server-side logic for "upcoming" vs "past"
    const isUpcoming = eventStart > now && isEventLive;
    const isPast = eventStart <= now || !isEventLive;

    // Privacy/Lifecycle: Only show publicly visible events to other viewers.
    // Uses canonical PUBLIC_LIFECYCLE_STATES (scheduled | live) — mirrors Firestore rules & Algolia sync.
    const isPublic = PUBLIC_LIFECYCLE_STATES.includes(event.lifecycle);
    const isSelf = profileUserId === viewerUserId;
    const isCompleted = event.lifecycle === 'completed';

    if (!isPublic && !isCompleted && !isSelf) return;

    const summary = {
      eventId: event.id,
      title: event.title,
      startAt: event.startDate || event.startAt,
      venueName: event.venue || event.location || event.venueName,
      city: event.city,
      posterUrl: event.image || event.poster,
      participationType: participation?.type || 'INTERESTED', // Default if just fetched via ID
    };

    if (isSelf) {
      summary.lifecycle = event.lifecycle;
      summary.ownerOnlyParticipationId = participation?.id;
    }

    if (isUpcoming) {
      upcoming.push(summary);
    } else if (isPast) {
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

  const TICKETS_CACHE_KEY = `user:tickets:${userId}`;
  const cached = await cacheGet(TICKETS_CACHE_KEY);
  if (cached) return cached;

  if (!isFirebaseConfigured()) {
    const { events } = await import('../../data/events.js');
    const mockTickets = (events || []).slice(0, 4).map((event, i) => {
      const isRSVP = i % 2 !== 0;
      const isPast = i >= 2;
      const ticketId = isRSVP ? `RSVP-${event.id}-${i}` : `mock-${event.id}-${i}`;
      const secret = (() => {
        const s = process.env.TICKET_SECRET;
        if (!s) throw new Error('TICKET_SECRET environment variable is not set');
        return s;
      })();
      const signature = createHmac('sha256', secret).update(ticketId).digest('hex').slice(0, 16);

      return {
        ticketId,
        eventId: event.id,
        eventTitle: event.title,
        eventStartAt: event.startDate || event.startAt || new Date().toISOString(),
        venueName: event.venue || event.location,
        city: event.city || 'Pune',
        posterUrl: event.image,
        ticketType: isRSVP ? 'RSVP' : i === 0 ? 'VIP Access' : 'General Admission',
        qrPayload: `${ticketId}:${createHmac('sha256', getTicketSecret()).update(ticketId).digest('hex')}`,
        status: isPast ? 'used' : 'active',
      };
    });

    return {
      upcomingTickets: mockTickets.filter((t) => t.status === 'active'),
      pastTickets: mockTickets.filter((t) => t.status === 'used'),
      actionNeeded: [],
      cancelledTickets: [],
    };
  }

  try {
    setTimeout(async () => {
      try {
        const { cleanupStaleOrders } = await import('@c1rcle/core/order-engine');
        await cleanupStaleOrders(userId);
      } catch (err) {
        console.error('[ProfileStore] Background stale order cleanup failed:', err);
      }
    }, 0);
  } catch (err) {
    console.error('[ProfileStore] Failed to queue stale order cleanup in getUserTickets:', err);
  }

  const startedAt = Date.now();
  const db = getAdminDb();
  const userProfile = await getUserProfile(userId);
  const userGender = userProfile?.gender || 'any';
  const userEmail = userProfile?.email;

  // 1. Fetch ALL orders (Paid and RSVP) for this user
  const [ordersSnapshot, rsvpsSnapshot] = await Promise.all([
    db.collection('orders').where('userId', '==', userId).get(),
    db.collection('rsvp_orders').where('userId', '==', userId).get(),
  ]);

  const orderDocs = ordersSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    isRSVP: false,
  }));
  const rsvpOrderDocs = rsvpsSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
    isRSVP: true,
  }));
  const allOrders = [...orderDocs, ...rsvpOrderDocs];

  // 2. Event IDs for RSVPs in profile (Legacy support)
  const profileRsvpEventIds = userProfile?.attendedEvents || [];

  // 3–5.5. Fetch all secondary data in parallel (was sequential — 5 round-trips, now 1)
  const { getUserClaimedTickets, getPendingTransfers, getOrderShareBundles, getOrderAssignments } =
    await import('@c1rcle/core/ticket-share-engine');
  const [
    claimedTickets,
    transfers,
    partnerAssignmentsSnapshot,
    ownerAssignmentsSnapshot,
    entitlementsSnapshot,
  ] = await Promise.all([
    getUserClaimedTickets(userId),
    userEmail ? getPendingTransfers(userId, userEmail) : Promise.resolve([]),
    db.collection('couple_assignments').where('partnerId', '==', userId).get(),
    db.collection('couple_assignments').where('ownerId', '==', userId).get(),
    db.collection('entitlements').where('ownerUserId', '==', userId).get(),
  ]);

  const pendingSentTicketIds = transfers.filter((t) => t.isSender).map((t) => t.ticketId);
  const partnerAssignments = partnerAssignmentsSnapshot.docs.map((doc) => ({
    ticketId: doc.id,
    ...doc.data(),
  }));
  const ownerAssignmentsMap = {};
  ownerAssignmentsSnapshot.docs.forEach((doc) => {
    ownerAssignmentsMap[doc.id] = doc.data();
  });
  const entitlements = entitlementsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  // 6. Collect all event IDs and fetch them in parallel with the above
  const allEventIds = Array.from(
    new Set(
      [
        ...allOrders.map((o) => o.eventId),
        ...profileRsvpEventIds,
        ...claimedTickets.map((t) => t.eventId),
        ...partnerAssignments.map((t) => t.eventId),
        ...transfers.map((t) => t.eventId),
      ].filter(Boolean),
    ),
  );

  // Phase 2.2: pre-populate from denormalized eventSummary embedded in each entitlement at issuance.
  // For every event that has at least one entitlement with a summary, the Firestore read is eliminated.
  const eventsData = {};
  entitlements.forEach((ent) => {
    if (ent.eventSummary && ent.eventId && !eventsData[ent.eventId]) {
      const es = ent.eventSummary;
      eventsData[ent.eventId] = {
        id: ent.eventId,
        title: es.title,
        startDate: es.startAt,
        startAt: es.startAt,
        venue: es.venue,
        venueName: es.venue,
        location: es.venue,
        city: es.city,
        image: es.posterUrl,
      };
    }
  });

  // Fetch only event IDs not already satisfied by denormalized summaries
  const missingEventIds = allEventIds.filter((id) => !eventsData[id]);
  if (missingEventIds.length > 0) {
    const snapshots = await Promise.all(
      missingEventIds.map((id) => db.collection('events').doc(id).get()),
    );
    snapshots.forEach((s) => {
      if (s.exists) eventsData[s.id] = { id: s.id, ...s.data() };
    });
  }

  const now = new Date();
  const upcoming = [];
  const past = [];
  const actionNeeded = [];
  const cancelled = [];

  // 7 + 8. Fetch share bundles and ticket scans in parallel
  const allTicketIdsToCheck = [];
  allOrders.forEach((order) => {
    order.tickets?.forEach((tg) => {
      for (let i = 1; i <= tg.quantity; i++)
        allTicketIdsToCheck.push(`${order.id}-${tg.ticketId}-${i}`);
    });
  });

  const shareBundlesMap = {};
  const scansMap = {};

  await Promise.all([
    // Share bundles per order
    Promise.all(
      allOrders.map(async (order) => {
        const [bundles, assignments] = await Promise.all([
          getOrderShareBundles(order.id),
          getOrderAssignments(order.id),
        ]);
        shareBundlesMap[order.id] = { bundles, assignments };
      }),
    ),
    // Ticket scans in chunks of 30 (Firestore `in` limit)
    allTicketIdsToCheck.length > 0
      ? Promise.all(
          (() => {
            const chunks = [];
            for (let i = 0; i < allTicketIdsToCheck.length; i += 30)
              chunks.push(allTicketIdsToCheck.slice(i, i + 30));
            return chunks;
          })().map(async (chunk) => {
            const snap = await Promise.all(
              chunk.map((id) => db.collection('ticket_scans').doc(id).get()),
            );
            snap.forEach((s) => {
              if (s.exists) scansMap[s.id] = s.data();
            });
          }),
        )
      : Promise.resolve(),
  ]);

  // 8.5 Fetch Profiles for all involved users (Redeemers, Partners, etc.)
  const involvedUids = new Set([userId]);
  Object.values(shareBundlesMap).forEach(({ assignments }) => {
    assignments.forEach((a) => {
      if (a.redeemerId) involvedUids.add(a.redeemerId);
    });
  });
  claimedTickets.forEach((t) => {
    if (t.redeemerId) involvedUids.add(t.redeemerId);
    if (t.originalPurchaserId) involvedUids.add(t.originalPurchaserId);
  });
  partnerAssignments.forEach((a) => {
    if (a.partnerId) involvedUids.add(a.partnerId);
    if (a.ownerId) involvedUids.add(a.ownerId);
  });
  transfers.forEach((t) => {
    if (t.senderId) involvedUids.add(t.senderId);
    // recipient is email, we might not have UID yet
  });

  const profilesMap = {};
  const uidList = Array.from(involvedUids).filter(Boolean);
  if (uidList.length > 0) {
    const chunks = [];
    for (let i = 0; i < uidList.length; i += 30) chunks.push(uidList.slice(i, i + 30));
    await Promise.all(
      chunks.map(async (chunk) => {
        const snap = await db.collection(USERS_COLLECTION).where('__name__', 'in', chunk).get();
        const foundUids = new Set();

        snap.forEach((doc) => {
          foundUids.add(doc.id);
          const data = doc.data();
          const photoURL = data.photoURL || data.avatar || null;
          profilesMap[doc.id] = {
            uid: doc.id,
            displayName: data.displayName || 'C1RCLE User',
            photoURL: photoURL,
            avatar: photoURL,
          };
        });

        // Fallback for UIDs missing from Firestore: fetch from Firebase Auth
        const missingUids = chunk.filter((id) => !foundUids.has(id));
        if (missingUids.length > 0) {
          try {
            const auth = getAuth(getAdminApp());
            const authResults = await auth.getUsers(missingUids.map((id) => ({ uid: id })));
            authResults.users.forEach((userRecord) => {
              profilesMap[userRecord.uid] = {
                uid: userRecord.uid,
                displayName: userRecord.displayName || 'C1RCLE User',
                photoURL: userRecord.photoURL || null,
                avatar: userRecord.photoURL || null,
              };
            });
          } catch (e) {
            console.warn(`[ProfileStore] Batch Auth fallback failed:`, e.message);
          }
        }
      }),
    );
  }

  // 9. Process All Orders (Unroll identities)
  allOrders.forEach((order) => {
    const event = eventsData[order.eventId];
    if (!event) return;

    const { endAt } = getEventTimestamps(event);
    const isEventPast = endAt
      ? endAt < now.getTime()
      : new Date(event.startDate || event.startAt).getTime() < now.getTime();

    if (order.status === 'pending_payment' || order.status === 'payment_pending') {
      // We NO LONGER show pending orders in the Tickets dashboard to prevent "ticket hoarding".
      // If the user leaves the checkout process, the ticket is abandoned.
      // A background cleanup job or the inventory logic will return it to the pool.
      return;
    }

    if (order.status === 'cancelled' || order.status === 'refunded') {
      cancelled.push({
        type: 'order',
        id: order.id,
        eventId: event.id,
        eventTitle: event.title,
        eventStartAt: event.startDate || event.startAt,
        posterUrl: event.image,
        status: order.status,
        totalAmount: order.totalAmount,
      });
      return;
    }

    if (order.status === 'confirmed' || order.status === 'used') {
      const { bundles = [], assignments = [] } = shareBundlesMap[order.id] || {};

      let buyerAlreadyAssigned = false;

      order.tickets?.forEach((ticketGroup) => {
        const tierId = ticketGroup.ticketId;
        const units = ticketGroup.quantity;
        const bundle = bundles.find((b) => b.tierId === tierId);
        const isCouple =
          (ticketGroup.name || '').toLowerCase().includes('couple') || !!ticketGroup.isCouple;

        // One unit of couple ticket = 2 identities/slots
        const effectiveQuantity = isCouple ? units * 2 : units;

        // For each identity slot (1-based to match bundle slots)
        for (let i = 1; i <= effectiveQuantity; i++) {
          const slotTicketId = `${order.id}-${tierId}-${i}`;

          // Match assignment by slot index or identity ID
          const assignmentDoc = assignments.find(
            (a) => a.slotIndex === i || a.originalTicketId === slotTicketId,
          );
          const bundleSlot = bundle?.slots?.find((s) => s.slotIndex === i);

          // If claimed by someone else, we only show it to the order owner
          if (assignmentDoc && assignmentDoc.redeemerId !== userId && order.userId !== userId) {
            continue;
          }

          // Enrich assignment with profile info
          const assignment = assignmentDoc
            ? {
                ...assignmentDoc,
                userName: profilesMap[assignmentDoc.redeemerId]?.displayName || 'Guest',
                avatar: profilesMap[assignmentDoc.redeemerId]?.photoURL || null,
              }
            : null;

          const isTransferPending = pendingSentTicketIds.includes(slotTicketId);
          const tier = event.tickets?.find((t) => t.id === tierId);

          const isPrimaryBuyer = order.userId === userId;

          // Priority: Bundle Slot Gender > Tier Gender > Couple Parity
          let requiredGender = bundleSlot?.requiredGender || tier?.requiredGender;
          if (!requiredGender || requiredGender === 'any') {
            if (isCouple) {
              // Slot 1 is the buyer (Primary Buyer). Slot 2 is the partner.
              // We use modulo for bundles larger than 1 couple unit if they exist.
              if (i % 2 === 1) {
                requiredGender =
                  bundleSlot?.requiredGender || (isPrimaryBuyer ? userGender : 'male');
              } else {
                // Partner slot is the opposite of the buyer's gender if known
                const buyerIsFemale = isPrimaryBuyer && userGender === 'female';
                requiredGender = bundleSlot?.requiredGender || (buyerIsFemale ? 'male' : 'female');
              }
            } else {
              requiredGender = 'any';
            }
          }

          // A slot is "for me" if I'm the primary buyer at slot 1, or if I'm explicitly assigned to it.
          // This prevents the owner from seeing "Gender Mismatch" on their partner's slot.
          const isForMe =
            (i === 1 && isPrimaryBuyer) || (assignment && assignment.redeemerId === userId);

          const genderMismatch =
            isForMe &&
            requiredGender &&
            requiredGender !== 'any' &&
            userGender &&
            userGender !== 'any' &&
            requiredGender.toLowerCase() !== userGender.toLowerCase();

          // LOGIC: The buyer is assigned to the FIRST eligible Slot 1 in the order.
          // If they transfer that slot, their identity "floats" to the next available Slot 1.
          const isExplicitlyAssignedToMe = assignment && assignment.redeemerId === userId;
          const isOwnerLockedToMe =
            bundleSlot?.slotType === 'owner_locked' && bundleSlot?.claimStatus === 'claimed';
          const shouldAutoClaim =
            i === 1 && isPrimaryBuyer && !buyerAlreadyAssigned && !genderMismatch;

          const isClaimedByMe = isExplicitlyAssignedToMe || isOwnerLockedToMe || shouldAutoClaim;

          if (isClaimedByMe) {
            buyerAlreadyAssigned = true;
          }

          const ticket = {
            ticketId: slotTicketId,
            orderId: order.id,
            eventId: event.id,
            tierId,
            eventTitle: event.title,
            eventSlug: event.slug || event.id,
            eventStartAt: event.startDate || event.startAt,
            venueName: event.venue || event.venueName || event.location || 'TBD',
            city: event.city || 'Pune',
            posterUrl: event.image,
            ticketType: ticketGroup.name,
            status: 'active',
            isCouple,
            requiredGender,
            genderMismatch,
            isTransferPending,
            isPrimaryBuyer,
            isBundle: effectiveQuantity > 1,
            slotIndex: i,
            bundleId: bundle?.id,
            shareToken: bundle?.token,
            assignment: assignment || null,
            isClaimedByOther: assignment && assignment.redeemerId !== userId,
            isClaimed: isClaimedByMe,
            orderType: order.isRSVP ? 'RSVP' : order.totalAmount === 0 ? '₹0 Checkout' : 'Paid',
          };

          const scan = scansMap[slotTicketId];
          if (scan || order.status === 'used' || isEventPast) {
            ticket.status = 'used';
            ticket.scannedAt = scan?.scannedAt || order.updatedAt;
            past.push(ticket);
          } else {
            const canViewQR = !isTransferPending && !genderMismatch;

            // Entitlement matching
            const bundleEntId = bundleSlot?.entitlementId;
            const entMatch = entitlements.find(
              (e) =>
                e.orderId === order.id && e.metadata.tierId === tierId && e.metadata.index === i,
            );
            ticket.entitlementId = bundleEntId || entMatch?.id;

            if (canViewQR) {
              if (ticket.entitlementId) {
                // Redacted from list view for security.
                // Must be fetched via GET /tickets/:id
                ticket.hasQR = true;
              } else {
                ticket.hasQR = true;
              }
            } else {
              ticket.hasQR = false;
            }
            ticket.qrPayload = null; // Enforce redaction

            upcoming.push(ticket);
          }
        }
      });
    }
  });

  // 10. Process Claimed/Transferred Tickets
  claimedTickets.forEach((claimDoc) => {
    const event = eventsData[claimDoc.eventId];
    if (!event) return;

    const eventStart = new Date(event.startDate || event.startAt);
    const isEventPast = eventStart < now;

    const requiredGender = claimDoc.requiredGender || 'any';
    const genderMismatch =
      requiredGender &&
      requiredGender !== 'any' &&
      userGender &&
      userGender !== 'any' &&
      requiredGender.toLowerCase() !== userGender.toLowerCase();

    const claim = {
      ...claimDoc,
      userName: profilesMap[claimDoc.redeemerId]?.displayName || 'Guest',
      avatar: profilesMap[claimDoc.redeemerId]?.photoURL || null,
    };

    const ticket = {
      ticketId: claim.assignmentId,
      orderId: claim.orderId,
      eventId: event.id,
      eventTitle: event.title,
      eventStartAt: event.startDate || event.startAt,
      venueName: event.venue || event.location,
      city: event.city,
      posterUrl: event.image,
      ticketType: claim.isRSVP
        ? 'RSVP'
        : claim.isSharedQr
          ? 'Shared Group Pass'
          : claim.originalTicketId
            ? 'Transferred Pass'
            : 'Shared Pass',
      status: claim.status === 'used' || isEventPast ? 'used' : 'active',
      isClaimed: true,
      isSharedQr: claim.isSharedQr,
      requiredGender,
      genderMismatch,
      couplePairId: claim.couplePairId || null,
      hasQR: genderMismatch || claim.status === 'used' || isEventPast ? false : true,
      qrPayload: null,
      orderType: claim.isRSVP ? 'RSVP' : 'Paid',
      assignment: claim,
    };

    if (ticket.status === 'active') {
      upcoming.push(ticket);
    } else {
      past.push(ticket);
    }
  });

  // 11. Process Partner Assignments
  partnerAssignments.forEach((assignmentDoc) => {
    const event = eventsData[assignmentDoc.eventId];
    if (!event) return;

    const eventStart = new Date(event.startDate || event.startAt);
    const isEventPast = eventStart < now;

    const ticketId = assignmentDoc.ticketId;
    const isScanned = !!scansMap[ticketId];
    const status = isScanned || isEventPast ? 'used' : 'active';

    const assignment = {
      ...assignmentDoc,
      userName: profilesMap[assignmentDoc.partnerId]?.displayName || 'Partner',
      avatar: profilesMap[assignmentDoc.partnerId]?.photoURL || null,
    };

    const ticket = {
      ticketId,
      eventId: event.id,
      eventTitle: event.title,
      eventStartAt: event.startDate || event.startAt,
      venueName: event.venue || event.location,
      city: event.city,
      posterUrl: event.image,
      ticketType: 'Couple Pass (Female)', // Couple partners are usually the female slot
      status,
      isCouplePartner: true,
      requiredGender: 'female',
      genderMismatch: userGender !== 'any' && userGender !== 'female',
      hasQR: status === 'active' && (userGender === 'any' || userGender === 'female'),
      qrPayload: null,
      orderType: 'Paid',
      coupleAssignment: assignment,
      assignment,
    };

    if (status === 'active') upcoming.push(ticket);
    else past.push(ticket);
  });

  // 12. Process Legacy RSVPs (Only if not already processed as identities)
  profileRsvpEventIds.forEach((eventId) => {
    if (upcoming.some((t) => t.eventId === eventId) || past.some((t) => t.eventId === eventId))
      return;

    const event = eventsData[eventId];
    if (!event) return;

    const eventStart = new Date(event.startDate || event.startAt);
    const isEventPast = eventStart < now;
    const status = isEventPast ? 'used' : 'active';

    const ticketId = `RSVP-${userId}-${eventId}`;

    const ticket = {
      ticketId,
      eventId: event.id,
      eventTitle: event.title,
      eventStartAt: event.startDate || event.startAt,
      venueName: event.venue || event.location,
      city: event.city,
      posterUrl: event.image,
      ticketType: 'RSVP',
      qrPayload:
        status === 'active'
          ? `${ticketId}:${createHmac('sha256', getTicketSecret()).update(ticketId).digest('hex')}`
          : null,
      status,
      orderType: 'RSVP',
    };

    if (status === 'active') upcoming.push(ticket);
    else past.push(ticket);
  });

  // 13. Process Pending Transfers for recipient
  transfers
    .filter((t) => !t.isSender)
    .forEach((transfer) => {
      const event = eventsData[transfer.eventId];
      actionNeeded.push({
        type: 'transfer',
        id: transfer.id,
        transfer,
        eventId: transfer.eventId,
        eventTitle: event?.title || 'Unknown Event',
        eventStartAt: event?.startDate || event?.startAt,
        posterUrl: event?.image,
        reason: 'Incoming Transfer',
        status: 'pending',
      });
    });

  // Sort
  upcoming.sort((a, b) => new Date(a.eventStartAt) - new Date(b.eventStartAt));
  past.sort((a, b) => new Date(b.eventStartAt) - new Date(a.eventStartAt));

  const result = {
    upcomingTickets: upcoming,
    pastTickets: past,
    actionNeeded,
    cancelledTickets: cancelled,
    shareBundles: shareBundlesMap,
  };

  // Cache for 2 minutes — invalidated immediately on any order/ticket mutation
  await cacheSet(TICKETS_CACHE_KEY, result, 120);
  const durationMs = Date.now() - startedAt;
  if (durationMs >= 150) {
    console.info(`[guest-tickets] built tickets wallet for ${userId} in ${durationMs}ms`);
  }

  return result;
}

/**
 * Bust the tickets cache for a user.
 * Call this after any order creation, confirmation, or cancellation.
 */
export async function invalidateTicketsCache(userId) {
  if (!userId) return;
  await cacheDel(`user:tickets:${userId}`);
}

const CLUBS_COLLECTION = 'venues';
const HOSTS_COLLECTION = 'hosts';
const PROFILE_POSTS_COLLECTION = 'profile_posts';
const PROFILE_HIGHLIGHTS_COLLECTION = 'profile_highlights';

const serializeDoc = (doc) => {
  if (!doc.exists) return null;
  const data = doc.data();
  const serialized = { id: doc.id, ...data };
  Object.keys(serialized).forEach((key) => {
    if (serialized[key] && typeof serialized[key].toDate === 'function') {
      serialized[key] = serialized[key].toDate().toISOString();
    }
  });
  return serialized;
};

export async function getProfilePosts(profileId, type, limit = 20) {
  if (!isFirebaseConfigured()) return [];
  const db = getAdminDb();
  const snapshot = await db
    .collection(PROFILE_POSTS_COLLECTION)
    .where('profileId', '==', profileId)
    .where('profileType', '==', type)
    .limit(limit)
    .get();
  return snapshot.docs
    .map(serializeDoc)
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
}

export async function getProfileHighlights(profileId, type) {
  if (!isFirebaseConfigured()) return [];
  const db = getAdminDb();
  const snapshot = await db
    .collection(PROFILE_HIGHLIGHTS_COLLECTION)
    .where('profileId', '==', profileId)
    .where('profileType', '==', type)
    .get();
  const now = new Date().toISOString();
  return snapshot.docs
    .map(serializeDoc)
    .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
    .filter((h) => h.permanent || !h.expiresAt || h.expiresAt > now);
}

export async function getProfileStats(profileId, type) {
  if (!isFirebaseConfigured())
    return { followersCount: 1200, postsCount: 5, totalLikes: 450, totalViews: 2800 };
  const posts = await getProfilePosts(profileId, type);
  const highlights = await getProfileHighlights(profileId, type);
  const db = getAdminDb();
  const collection = type === 'venue' ? CLUBS_COLLECTION : HOSTS_COLLECTION;
  const profileDoc = await db.collection(collection).doc(profileId).get();
  const profileData = profileDoc.data();
  return {
    followersCount: profileData?.followersCount || profileData?.followers || 0,
    postsCount: posts.length,
    highlightsCount: highlights.length,
    totalLikes: posts.reduce((sum, p) => sum + (p.likes || 0), 0),
    totalViews: highlights.reduce((sum, h) => sum + (h.views || 0), 0),
  };
}
