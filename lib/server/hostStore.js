import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";

// Static fallback data (migrated from data/hosts.js)
const fallbackHosts = [
    {
        handle: "@after_dark_india",
        name: "After Dark India",
        avatar: "/events/genz-night.svg",
        followers: 18400,
        bio: "Nightlife curators building the late-night economy across Pune and Mumbai.",
        location: "Pune, IN",
        verified: true
    },
    {
        handle: "@campuscollective",
        name: "Campus Collective",
        avatar: "/events/campus.svg",
        followers: 9200,
        bio: "Day parties, cookouts, and art walks for India’s campus crowd.",
        location: "Pune, IN",
        verified: true
    },
    {
        handle: "@quiethours",
        name: "Quiet Hours",
        avatar: "/events/lofi-house.svg",
        followers: 6100,
        bio: "Mindful rooftops, lofi flows, and slow-living residencies.",
        location: "Baner, Pune",
        verified: false
    },
    {
        handle: "@underground.studio",
        name: "Underground Studio",
        avatar: "/events/art-bazaar.svg",
        followers: 12100,
        bio: "Immersive AV clubs blending art, poetry, and analog synth jams.",
        location: "Viman Nagar, Pune",
        verified: true
    }
];

const HOSTS_COLLECTION = "hosts";

/**
 * Get a host profile by their handle (e.g. @after_dark_india)
 */
export async function getHostByHandle(handle) {
    if (!handle) return null;
    const normalizedHandle = handle.startsWith("@") ? handle : `@${handle}`;

    if (!isFirebaseConfigured()) {
        return fallbackHosts.find(h => h.handle === normalizedHandle) || null;
    }

    const db = getAdminDb();

    // Try to find by handle field
    const snapshot = await db
        .collection(HOSTS_COLLECTION)
        .where("handle", "==", normalizedHandle)
        .limit(1)
        .get();

    if (!snapshot.empty) {
        return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    }

    // Fallback for dev/demo purposes if not found in DB
    return fallbackHosts.find(h => h.handle === normalizedHandle) || null;
}

/**
 * Increment follower count atomically
 */
export async function followHost(hostId) {
    if (!isFirebaseConfigured()) return;

    const db = getAdminDb();
    const FieldValue = require("firebase-admin/firestore").FieldValue;

    await db.collection(HOSTS_COLLECTION).doc(hostId).update({
        followers: FieldValue.increment(1)
    });
}
