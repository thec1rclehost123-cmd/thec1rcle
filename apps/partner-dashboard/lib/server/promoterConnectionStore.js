/**
 * Promoter Connection Store
 * Manages partnership requests between promoters and hosts/clubs
 */

import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";
import { getFirebaseDb } from "../firebase/client";
import { collection, getDocs, query, where, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { Timestamp } from "firebase-admin/firestore";
import { randomUUID } from "node:crypto";
import { hosts as seedHosts } from "../../data/hosts";
import { events as seedEvents } from "../../data/events";

const CONNECTIONS_COLLECTION = "promoter_connections";
const CLUBS_COLLECTION = "venues";
const HOSTS_COLLECTION = "hosts";
const PROMOTERS_COLLECTION = "promoters";
const AUDIT_LOGS_COLLECTION = "audit_logs";

async function createAuditLog(db, { type, entityId, action, actorId, actorRole, metadata = {} }) {
    await db.collection(AUDIT_LOGS_COLLECTION).add({
        type,
        entityId,
        action,
        actorId,
        actorRole,
        metadata,
        timestamp: Timestamp.now()
    });
}

/**
 * Robust fetch for venues/hosts/promoters that works even in local dev without Admin keys
 * Only returns admin-approved partners (status: 'active', isVerified: true, or isApproved: true)
 */
async function fetchPartners(type, searchCity, searchTerm, maxLimit = 20) {
    console.log(`[Discovery] Fetching ${type}s. City: ${searchCity}, Search: ${searchTerm}`);
    let results = [];

    // Map type to collection name
    let collectionName;
    switch (type) {
        case "host": collectionName = HOSTS_COLLECTION; break;
        case "club": collectionName = CLUBS_COLLECTION; break;
        case "promoter": collectionName = PROMOTERS_COLLECTION; break;
        default: collectionName = type; // Support custom collections if needed
    }

    // 1. Try Admin SDK - Query only active/approved partners
    if (isFirebaseConfigured()) {
        try {
            const db = getAdminDb();
            // Query for active partners only
            let queryRef = db.collection(collectionName).where("status", "==", "active").limit(maxLimit * 5);
            let snapshot = await queryRef.get();

            // If no active status matches, try isVerified
            if (snapshot.empty) {
                queryRef = db.collection(collectionName).where("isVerified", "==", true).limit(maxLimit * 5);
                snapshot = await queryRef.get();
            }

            // Fallback: get all and filter client-side (for legacy data)
            if (snapshot.empty) {
                snapshot = await db.collection(collectionName).limit(maxLimit * 5).get();
            }

            results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log(`[Discovery] Admin SDK found ${results.length} ${type}s`);
        } catch (e) {
            console.warn(`Admin SDK discovery failed for ${type}:`, e.message);
        }
    }

    // 2. Try Client SDK (Public collection fallback)
    if (results.length === 0) {
        try {
            const db = getFirebaseDb();
            const snap = await getDocs(collection(db, collectionName));
            results = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            console.log(`[Discovery] Client SDK found ${results.length} ${type}s`);
        } catch (e) {
            console.warn(`Client SDK Fallback discovery failed for ${type}:`, e.message);
        }
    }

    // 3. Use Demo Data for Dev/Testing (when no Firestore data exists)
    if (results.length === 0) {
        console.log(`[Discovery] Using demo partner data for ${type}`);
        results = getDemoPartners(type);
    }

    // Filter for admin-approved partners only
    results = results.filter(r =>
        r.status === "active" ||
        r.isVerified === true ||
        r.isApproved === true ||
        r.isActive === true ||
        r._isDemoData // Allow demo data through
    );

    // Client-side filtering (City & Name)
    if (searchCity && searchCity !== "" && searchCity.toLowerCase() !== "all") {
        const cityLower = searchCity.toLowerCase();
        results = results.filter(r =>
            (r.city || "").toLowerCase().includes(cityLower) ||
            (r.location || "").toLowerCase().includes(cityLower)
        );
    }

    if (searchTerm) {
        const s = searchTerm.toLowerCase();
        results = results.filter(r =>
            (r.name || r.displayName || "").toLowerCase().includes(s) ||
            (r.bio || r.summary || "").toLowerCase().includes(s)
        );
    }

    return results.slice(0, maxLimit).map(r => ({
        id: r.id,
        type: type,
        name: r.displayName || r.name || "Unknown",
        avatar: r.profileImage || r.avatar || null,
        coverImage: r.coverImage || r.bannerImage || null,
        city: r.city || (r.location?.split?.(',')[0]?.trim?.()) || "Pune",
        bio: r.bio || r.summary || r.description || "",
        tags: r.tags || r.genres || [],
        eventsCount: r.eventsCount || r.totalEvents || 0,
        followersCount: parseInt(r.followers) || r.followersCount || 0,
        isVerified: !!(r.isVerified || r.isApproved || r.status === "active" || r.isActive === true)
    }));
}

/**
 * Generate demo partners for local development/testing
 */
function getDemoPartners(type) {
    if (type === "host") {
        return [
            {
                id: "demo-host-afterdark",
                name: "After Dark India",
                displayName: "After Dark India",
                bio: "Nightlife curators building the late-night economy across Pune and Mumbai. Host of the biggest college parties.",
                city: "Pune",
                avatar: "/events/neon-nights.jpg",
                coverImage: "/events/techno-bunker.jpg",
                followersCount: 18400,
                eventsCount: 24,
                tags: ["Nightlife", "College", "EDM"],
                isVerified: true,
                status: "active",
                _isDemoData: true
            },
            {
                id: "demo-host-quiethours",
                name: "Quiet Hours",
                displayName: "Quiet Hours",
                bio: "Mindful rooftops, lofi flows, and slow-living residencies. Creating intentional spaces for connection.",
                city: "Baner, Pune",
                avatar: "/events/rooftop-jazz.jpg",
                coverImage: "/events/lofi-house.svg",
                followersCount: 6100,
                eventsCount: 12,
                tags: ["Wellness", "Breathwork", "Rooftop"],
                isVerified: true,
                status: "active",
                _isDemoData: true
            },
            {
                id: "demo-host-underground",
                name: "Underground Studio",
                displayName: "Underground Studio",
                bio: "Immersive AV clubs blending art, poetry, and analog synth jams in Pune's creative districts.",
                city: "Viman Nagar, Pune",
                avatar: "/events/art-collective.jpg",
                coverImage: "/events/art-bazaar.svg",
                followersCount: 12100,
                eventsCount: 18,
                tags: ["Art", "Live Music", "Indie"],
                isVerified: true,
                status: "active",
                _isDemoData: true
            },
            {
                id: "demo-host-campuscrew",
                name: "Campus Collective",
                displayName: "Campus Collective",
                bio: "Day parties, cookouts, and art walks for India's campus crowd. Building community one event at a time.",
                city: "FC Road, Pune",
                avatar: "/events/poolside-vibes.jpg",
                coverImage: "/events/campus.svg",
                followersCount: 9200,
                eventsCount: 15,
                tags: ["College", "Day Party", "Community"],
                isVerified: true,
                status: "active",
                _isDemoData: true
            },
            {
                id: "demo-host-neonlabs",
                name: "Neon Labs Mumbai",
                displayName: "Neon Labs Mumbai",
                bio: "Electronic music collective pushing the boundaries of club culture in Mumbai's underground scene.",
                city: "Mumbai",
                avatar: "/events/electric-dreams.jpg",
                coverImage: "/events/disclosure.svg",
                followersCount: 22500,
                eventsCount: 32,
                tags: ["Techno", "House", "Electronic"],
                isVerified: true,
                status: "active",
                _isDemoData: true
            }
        ];
    } else {
        return [
            {
                id: "demo-club-highspirits",
                name: "High Spirits",
                displayName: "High Spirits",
                bio: "Pune's iconic live music venue. Three stages, legendary acoustics, and a decade of unforgettable nights.",
                city: "Pune",
                avatar: "/events/indie-jam.jpg",
                coverImage: "/events/neon-nights.jpg",
                followersCount: 45000,
                eventsCount: 156,
                tags: ["Live Music", "Concerts", "Club"],
                capacity: 800,
                isVerified: true,
                status: "active",
                _isDemoData: true
            },
            {
                id: "demo-club-antisocial",
                name: "antiSOCIAL",
                displayName: "antiSOCIAL",
                bio: "Underground culture hub. From indie gigs to DJ nights, we're where the cool kids hang.",
                city: "Mumbai",
                avatar: "/events/techno-bunker.jpg",
                coverImage: "/events/art-collective.jpg",
                followersCount: 38000,
                eventsCount: 124,
                tags: ["Underground", "Indie", "DJ"],
                capacity: 600,
                isVerified: true,
                status: "active",
                _isDemoData: true
            },
            {
                id: "demo-club-kitty",
                name: "Kitty Ko",
                displayName: "Kitty Ko",
                bio: "Premium nightlife destination with world-class sound and lighting. Where celebrities party in Bangalore.",
                city: "Bengaluru",
                avatar: "/events/electric-dreams.jpg",
                coverImage: "/events/disclosure.svg",
                followersCount: 52000,
                eventsCount: 89,
                tags: ["Premium", "Nightclub", "VIP"],
                capacity: 1000,
                isVerified: true,
                status: "active",
                _isDemoData: true
            },
            {
                id: "demo-club-effingut",
                name: "Effingut Brewpub",
                displayName: "Effingut Brewpub",
                bio: "Pune's first microbrewery with a live music venue. Craft beers and great tunes under one roof.",
                city: "Pune",
                avatar: "/events/rooftop-jazz.jpg",
                coverImage: "/events/poolside-vibes.jpg",
                followersCount: 28000,
                eventsCount: 67,
                tags: ["Brewpub", "Live Music", "Craft Beer"],
                capacity: 350,
                isVerified: true,
                status: "active",
                _isDemoData: true
            },
            {
                id: "demo-club-titos",
                name: "Tito's Lane",
                displayName: "Tito's Lane",
                bio: "Goa's most famous nightlife strip. The original party destination since 1971.",
                city: "Goa",
                avatar: "/events/neon-nights.jpg",
                coverImage: "/events/palm-tree.svg",
                followersCount: 85000,
                eventsCount: 245,
                tags: ["Beach", "Nightlife", "Tourist"],
                capacity: 1500,
                isVerified: true,
                status: "active",
                _isDemoData: true
            }
        ];
    }
}

function getSeedVenues() {
    const venuesMap = new Map();
    // Safety check for empty events
    if (!seedEvents || !Array.isArray(seedEvents)) return [];

    seedEvents.forEach(event => {
        const venueName = event.venue || event.location;
        if (venueName) {
            const city = event.city || (event.location?.split(',').pop()?.trim()) || "Pune";
            const key = venueName.toLowerCase();
            if (!venuesMap.has(key)) {
                venuesMap.set(key, {
                    id: event.venueId || `seed-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
                    name: venueName,
                    city: city,
                    location: event.location || "",
                    bio: event.summary || event.description || `Popular venue in ${city}`,
                    isVerified: true
                });
            }
        }
    });
    return [...venuesMap.values()];
}

export async function discoverHosts({ city, search, limit = 20 } = {}) {
    return await fetchPartners("host", city, search, limit);
}

export async function discoverClubs({ city, search, limit = 20 } = {}) {
    return await fetchPartners("club", city, search, limit);
}

export async function discoverPromoters({ city, search, limit = 20 } = {}) {
    return await fetchPartners("promoter", city, search, limit);
}

/**
 * Discover partners of various types
 * @param {Object} options
 * @param {'host' | 'club' | 'promoter'} [options.type]
 * @param {string} [options.city]
 * @param {string} [options.search]
 * @param {number} [options.limit]
 */
export async function discoverPartners({ type, city, search, limit = 20 } = {}) {
    if (type === "host") return await discoverHosts({ city, search, limit });
    if (type === "club") return await discoverClubs({ city, search, limit });
    if (type === "promoter") return await discoverPromoters({ city, search, limit });

    const [hosts, clubs, promoters] = await Promise.all([
        discoverHosts({ city, search, limit: Math.ceil(limit / 3) }),
        discoverClubs({ city, search, limit: Math.ceil(limit / 3) }),
        discoverPromoters({ city, search, limit: Math.ceil(limit / 3) })
    ]);
    return [...hosts, ...clubs, ...promoters].slice(0, limit);
}

/**
 * List connections for a promoter
 */
export async function listPromoterConnections(promoterId, status = null) {
    if (!promoterId) return [];

    if (isFirebaseConfigured()) {
        try {
            const db = getAdminDb();
            let q = db.collection(CONNECTIONS_COLLECTION).where("promoterId", "==", promoterId);
            if (status) {
                if (Array.isArray(status)) q = q.where("status", "in", status);
                else q = q.where("status", "==", status);
            }
            const snap = await q.get();
            return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        } catch (e) { }
    }

    try {
        const db = getFirebaseDb();
        const q = query(collection(db, CONNECTIONS_COLLECTION), where("promoterId", "==", promoterId));
        const snap = await getDocs(q);
        let docs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        if (status) {
            if (Array.isArray(status)) docs = docs.filter(d => status.includes(d.status));
            else docs = docs.filter(d => d.status === status);
        }
        return docs;
    } catch (e) {
        console.warn("[Promoter Store] listPromoterConnections Fallback:", e.message);
    }

    return [];
}

/**
 * Create connection request
 * Promoter info is passed directly from the client to avoid needing Admin SDK
 */
export async function createConnectionRequest({
    promoterId,
    promoterName = "Promoter",
    promoterEmail = "",
    promoterInstagram = "",
    promoterPhone = "",
    promoterBio = "",
    targetId,
    targetType,
    targetName,
    message = ""
}) {
    if (!promoterId || !targetId) throw new Error("Missing promoterId or targetId");

    const id = randomUUID();
    const now = new Date().toISOString();

    const connectionData = {
        id,
        promoterId,
        promoterName: promoterName || "Promoter",
        promoterEmail: promoterEmail || "",
        promoterInstagram: promoterInstagram || "",
        promoterPhone: promoterPhone || "",
        promoterBio: promoterBio || "",
        targetId,
        targetType,
        targetName,
        message,
        status: "pending",
        createdAt: now,
        updatedAt: now,
        resolvedAt: null,
        resolvedBy: null
    };

    // Use Admin SDK for server-side writes (preferred)
    if (isFirebaseConfigured()) {
        try {
            const db = getAdminDb();
            await db.collection(CONNECTIONS_COLLECTION).doc(id).set(connectionData);

            await createAuditLog(db, {
                type: "promoter_connection",
                entityId: id,
                action: "requested",
                actorId: promoterId,
                actorRole: "promoter",
                metadata: { targetId, targetType, targetName, promoterName }
            });

            console.log(`[Connection] Created via Admin SDK: ${id}`);
            return { success: true, connection: connectionData };
        } catch (e) {
            console.error("[Connection] Admin SDK write failed:", e.message);
        }
    }

    // Fallback to Client SDK (requires proper auth in security rules)
    try {
        const db = getFirebaseDb();
        await setDoc(doc(db, CONNECTIONS_COLLECTION, id), connectionData);
        console.log(`[Connection] Created via Client SDK: ${id}`);
        return { success: true, connection: connectionData };
    } catch (e) {
        console.error("[Connection] Client SDK write failed:", e.message);
        throw new Error(`Failed to create connection request: ${e.message}`);
    }
}

/**
 * List incoming requests for a host/club
 * Pass status = null/undefined to get all requests, or specific status like 'pending', 'approved'
 */
export async function listIncomingRequests(targetId, targetType, status = null) {
    if (!targetId) return [];

    if (isFirebaseConfigured()) {
        try {
            const db = getAdminDb();
            let queryRef = db.collection(CONNECTIONS_COLLECTION)
                .where("targetId", "==", targetId)
                .where("targetType", "==", targetType);

            if (status) {
                queryRef = queryRef.where("status", "==", status);
            }

            const snapshot = await queryRef.get();
            const results = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            // Sort in memory to avoid index requirements
            return results.sort((a, b) => {
                const dateA = new Date(a.createdAt || 0);
                const dateB = new Date(b.createdAt || 0);
                return dateB - dateA;
            });
        } catch (e) {
            console.warn("[listIncomingRequests] Admin SDK error:", e.message);
        }
    }

    try {
        const db = getFirebaseDb();
        let constraints = [
            where("targetId", "==", targetId),
            where("targetType", "==", targetType)
        ];

        if (status) {
            constraints.push(where("status", "==", status));
        }

        const q = query(collection(db, CONNECTIONS_COLLECTION), ...constraints);
        const snap = await getDocs(q);
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (e) {
        console.warn("[listIncomingRequests] Client SDK error:", e.message);
        return [];
    }
}

export async function approveConnectionRequest(connectionId, approvedBy) {
    const update = { status: "approved", updatedAt: new Date().toISOString(), resolvedAt: new Date().toISOString(), resolvedBy: approvedBy };

    if (isFirebaseConfigured()) {
        const db = getAdminDb();
        const docRef = db.collection(CONNECTIONS_COLLECTION).doc(connectionId);
        const doc = await docRef.get();

        await docRef.update(update);

        await createAuditLog(db, {
            type: "promoter_connection",
            entityId: connectionId,
            action: "approved",
            actorId: approvedBy.uid,
            actorRole: approvedBy.role,
            metadata: { previousStatus: doc.exists ? doc.data().status : null }
        });
    } else {
        await updateDoc(doc(getFirebaseDb(), CONNECTIONS_COLLECTION, connectionId), update);
    }
    return { success: true };
}

export async function rejectConnectionRequest(connectionId, rejectedBy, reason = "") {
    const update = { status: "rejected", updatedAt: new Date().toISOString(), resolvedAt: new Date().toISOString(), resolvedBy: rejectedBy, rejectionReason: reason };

    if (isFirebaseConfigured()) {
        const db = getAdminDb();
        const docRef = db.collection(CONNECTIONS_COLLECTION).doc(connectionId);
        const doc = await docRef.get();

        await docRef.update(update);

        await createAuditLog(db, {
            type: "promoter_connection",
            entityId: connectionId,
            action: "rejected",
            actorId: rejectedBy.uid,
            actorRole: rejectedBy.role,
            metadata: { reason, previousStatus: doc.exists ? doc.data().status : null }
        });
    } else {
        await updateDoc(doc(getFirebaseDb(), CONNECTIONS_COLLECTION, connectionId), update);
    }
    return { success: true };
}

export async function blockConnectionRequest(connectionId, blockedBy, reason = "") {
    const update = { status: "blocked", updatedAt: new Date().toISOString(), resolvedAt: new Date().toISOString(), resolvedBy: blockedBy, blockReason: reason };

    if (isFirebaseConfigured()) {
        const db = getAdminDb();
        const docRef = db.collection(CONNECTIONS_COLLECTION).doc(connectionId);
        const doc = await docRef.get();

        await docRef.update(update);

        await createAuditLog(db, {
            type: "promoter_connection",
            entityId: connectionId,
            action: "blocked",
            actorId: blockedBy.uid,
            actorRole: blockedBy.role,
            metadata: { reason, previousStatus: doc.exists ? doc.data().status : null }
        });
    } else {
        await updateDoc(doc(getFirebaseDb(), CONNECTIONS_COLLECTION, connectionId), update);
    }
    return { success: true };
}

export async function cancelConnectionRequest(id, promoterId) {
    const update = { status: "cancelled", updatedAt: new Date().toISOString() };
    if (isFirebaseConfigured()) {
        await getAdminDb().collection(CONNECTIONS_COLLECTION).doc(id).update(update);
    } else {
        await updateDoc(doc(getFirebaseDb(), CONNECTIONS_COLLECTION, id), update);
    }
    return { success: true };
}

export async function revokeConnection(id, revokedBy) {
    const update = { status: "revoked", updatedAt: new Date().toISOString(), revokedAt: new Date().toISOString(), revokedBy };
    if (isFirebaseConfigured()) {
        await getAdminDb().collection(CONNECTIONS_COLLECTION).doc(id).update(update);
    } else {
        await updateDoc(doc(getFirebaseDb(), CONNECTIONS_COLLECTION, id), update);
    }
    return { success: true };
}

export async function getConnectionStatus(promoterId, targetId, targetType) {
    if (isFirebaseConfigured()) {
        try {
            const snap = await getAdminDb().collection(CONNECTIONS_COLLECTION)
                .where("promoterId", "==", promoterId)
                .where("targetId", "==", targetId)
                .get();
            if (!snap.empty) {
                const results = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                // Sort in memory and take the latest
                return results.sort((a, b) => {
                    const dateA = new Date(a.updatedAt || 0);
                    const dateB = new Date(b.updatedAt || 0);
                    return dateB - dateA;
                })[0];
            }
        } catch (e) {
            console.warn("[Promoter Store] getConnectionStatus Admin Fallback:", e.message);
        }
    }

    try {
        const db = getFirebaseDb();
        const q = query(
            collection(db, CONNECTIONS_COLLECTION),
            where("promoterId", "==", promoterId),
            where("targetId", "==", targetId)
        );
        const snap = await getDocs(q);
        if (snap.empty) return null;
        return { id: snap.docs[0].id, ...snap.docs[0].data() };
    } catch (e) {
        console.warn("[Promoter Store] getConnectionStatus Fallback:", e.message);
        return null;
    }
}

export async function getPromoterConnectionStats(pId) {
    const connections = await listPromoterConnections(pId);
    return {
        pending: connections.filter(c => c.status === "pending").length,
        approved: connections.filter(c => c.status === "approved").length,
        rejected: connections.filter(c => c.status === "rejected").length,
        total: connections.length
    };
}

export async function isConnected(pId, tId) {
    const status = await getConnectionStatus(pId, tId);
    return status?.status === "approved";
}

export async function getApprovedPartnerIds(promoterId) {
    const connections = await listPromoterConnections(promoterId, "approved");
    return {
        hostIds: connections.filter(c => c.targetType === "host").map(c => c.targetId),
        clubIds: connections.filter(c => c.targetType === "club").map(c => c.targetId)
    };
}
