import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";

// Extended fallback data for the premium experience
const fallbackHosts = [
    {
        id: "after-dark",
        slug: "after-dark",
        handle: "@after_dark_india",
        name: "After Dark India",
        avatar: "/events/genz-night.svg",
        cover: "/events/neon-nights.jpg",
        role: "Promoter",
        vibes: ["Techno", "House", "Afro"],
        followers: 18400,
        upcomingEventsCount: 4,
        nextEventDate: "2024-01-05",
        bio: "Nightlife curators building the late-night economy across Pune and Mumbai.",
        location: "Pune, IN",
        verified: true,
        trending: true,
        popular: true
    },
    {
        id: "campus-collective",
        slug: "campus-collective",
        handle: "@campuscollective",
        name: "Campus Collective",
        avatar: "/events/campus.svg",
        cover: "/events/poolside-vibes.jpg",
        role: "Collective",
        vibes: ["Bollywood", "Commercial", "Open format"],
        followers: 9200,
        upcomingEventsCount: 2,
        nextEventDate: "2024-01-12",
        bio: "Day parties, cookouts, and art walks for India’s campus crowd.",
        location: "Pune, IN",
        verified: true,
        trending: false,
        popular: true
    },
    {
        id: "quiet-hours",
        slug: "quiet-hours",
        handle: "@quiethours",
        name: "Quiet Hours",
        avatar: "/events/lofi-house.svg",
        cover: "/events/rooftop-jazz.jpg",
        role: "Promoter",
        vibes: ["House", "Deep House", "Melodic"],
        followers: 6100,
        upcomingEventsCount: 1,
        nextEventDate: "2024-01-08",
        bio: "Mindful rooftops, lofi flows, and slow-living residencies.",
        location: "Baner, Pune, IN",
        verified: false,
        trending: true,
        popular: false
    },
    {
        id: "underground-studio",
        slug: "underground-studio",
        handle: "@underground.studio",
        name: "Underground Studio",
        avatar: "/events/art-bazaar.svg",
        cover: "/events/techno-bunker.jpg",
        role: "Collective",
        vibes: ["Techno", "Underground", "Trance"],
        followers: 12100,
        upcomingEventsCount: 3,
        nextEventDate: "2024-01-06",
        bio: "Immersive AV clubs blending art, poetry, and analog synth jams.",
        location: "Viman Nagar, Pune, IN",
        verified: true,
        trending: false,
        popular: true
    },
    {
        id: "dj-soul",
        slug: "dj-soul",
        handle: "@djsoul",
        name: "DJ Soul",
        avatar: "https://api.dicebear.com/9.x/notionists/svg?seed=soul",
        cover: "/events/rooftop-jazz.jpg",
        role: "DJ",
        vibes: ["Afro", "Hip-hop", "House"],
        followers: 4300,
        upcomingEventsCount: 5,
        nextEventDate: "2024-01-03",
        bio: "Spinning the soul of the city. Afro-beat specialist.",
        location: "Pune, IN",
        verified: false,
        trending: true,
        popular: false
    }
];

const HOSTS_COLLECTION = "hosts";

/**
 * List hosts with filtering and sorting
 */
export async function listHosts({ search, role, vibe, status, time, sort } = {}) {
    if (!isFirebaseConfigured()) {
        let hosts = [...fallbackHosts];

        // Search
        if (search) {
            const lowSearch = search.toLowerCase();
            hosts = hosts.filter(h =>
                h.name.toLowerCase().includes(lowSearch) ||
                h.handle.toLowerCase().includes(lowSearch) ||
                h.vibes.some(v => v.toLowerCase().includes(lowSearch))
            );
        }

        // Role Filter
        if (role) {
            hosts = hosts.filter(h => h.role === role);
        }

        // Vibe Filter
        if (vibe) {
            hosts = hosts.filter(h => h.vibes.includes(vibe));
        }

        // Status Filter
        if (status === "Verified") hosts = hosts.filter(h => h.verified);
        if (status === "Trending") hosts = hosts.filter(h => h.trending);
        if (status === "Popular") hosts = hosts.filter(h => h.popular);

        // Time Filter (Simplified for fallback)
        if (time === "Has events this week") hosts = hosts.filter(h => h.upcomingEventsCount > 0);

        // Sorting
        if (sort === "Most followed") {
            hosts.sort((a, b) => b.followers - a.followers);
        } else if (sort === "Soonest event") {
            hosts.sort((a, b) => new Date(a.nextEventDate) - new Date(b.nextEventDate));
        } else {
            // Default "Popular" or trending
            hosts.sort((a, b) => (b.trending ? 1 : 0) - (a.trending ? 1 : 0) || b.followers - a.followers);
        }

        return hosts;
    }

    const db = getAdminDb();
    let query = db.collection(HOSTS_COLLECTION);

    // Apply basic Firestore filters if possible, else filter in-memory for complex ones
    if (role) query = query.where("role", "==", role);
    if (status === "Verified") query = query.where("verified", "==", true);

    const snapshot = await query.get();
    let hosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // In-memory filtering for more complex/search fields to avoid needing composite indexes for everything
    if (search) {
        const lowSearch = search.toLowerCase();
        hosts = hosts.filter(h =>
            h.name?.toLowerCase().includes(lowSearch) ||
            h.handle?.toLowerCase().includes(lowSearch) ||
            h.vibes?.some(v => v.toLowerCase().includes(lowSearch))
        );
    }

    if (vibe) {
        hosts = hosts.filter(h => h.vibes?.includes(vibe));
    }

    if (status === "Trending") hosts = hosts.filter(h => h.trending);
    if (status === "Popular") hosts = hosts.filter(h => h.popular);

    // Sorting
    if (sort === "Most followed") {
        hosts.sort((a, b) => (b.followers || 0) - (a.followers || 0));
    } else if (sort === "Soonest event") {
        hosts.sort((a, b) => new Date(a.nextEventDate || '9999-12-31') - new Date(b.nextEventDate || '9999-12-31'));
    }

    if (hosts.length === 0 && !search && !role && !vibe) return fallbackHosts;
    return hosts;
}

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
    const snapshot = await db.collection(HOSTS_COLLECTION).where("handle", "==", normalizedHandle).limit(1).get();

    if (!snapshot.empty) {
        return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    }

    return fallbackHosts.find(h => h.handle === normalizedHandle) || null;
}

/**
 * Get a host profile by their slug
 */
export async function getHostBySlug(slug) {
    if (!slug) return null;

    if (!isFirebaseConfigured()) {
        return fallbackHosts.find(h => h.slug === slug || h.handle.replace("@", "").replace("_", "-") === slug) || null;
    }

    const db = getAdminDb();
    const snapshot = await db.collection(HOSTS_COLLECTION).where("slug", "==", slug).limit(1).get();

    if (!snapshot.empty) {
        return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    }

    return getHostByHandle(slug);
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
