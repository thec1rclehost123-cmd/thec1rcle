import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";

const fallbackVenues = [
    {
        id: "high-spirits",
        slug: "high-spirits",
        name: "High Spirits",
        area: "Koregaon Park",
        image: "/events/neon-nights.jpg",
        followers: 12500,
        tags: ["Techno", "Rooftop", "Indie"],
        tablesAvailable: true,
        description: "Pune's legendary home for indie music and high energy nights.",
        rules: ["Must be 21+", "Casual dress encouraged"],
        dressCode: "Casual / House party vibes"
    },
    {
        id: "kp-social",
        slug: "kp-social",
        name: "Koregaon Park Social",
        area: "Koregaon Park",
        image: "/events/techno-bunker.jpg",
        followers: 45000,
        tags: ["Bollywood", "College", "Lounge"],
        tablesAvailable: true,
        description: "The neighborhood's favorite haunt for work and play.",
        rules: ["Smart casual", "Valid ID mandatory"],
        dressCode: "Smart Casual"
    },
    {
        id: "fc-road-courtyard",
        slug: "fc-road-courtyard",
        name: "FC Road Courtyard",
        area: "FC Road",
        image: "/events/poolside-vibes.jpg",
        followers: 8200,
        tags: ["Hip-Hop", "Rooftop", "College"],
        tablesAvailable: true,
        description: "Vibrant outdoor space in the heart of the city's student hub.",
        rules: ["Casual", "No outsiders after 11 PM"],
        dressCode: "Streetwear / Casual"
    },
    {
        id: "baner-loft",
        slug: "baner-loft",
        name: "Baner Terrace Loft",
        area: "Baner",
        image: "/events/rooftop-jazz.jpg",
        followers: 6100,
        tags: ["House", "Lounge", "Rooftop"],
        tablesAvailable: true,
        description: "Sophisticated penthouse vibes with panoramic city views.",
        rules: ["Must be 25+", "Reserved tables only"],
        dressCode: "Luxury / Chic"
    },
    {
        id: "kalyani-mansion",
        slug: "kalyani-mansion",
        name: "Kalyani Nagar Mansion",
        area: "Kalyani Nagar",
        image: "/events/genz-night.svg",
        followers: 8400,
        tags: ["Luxury", "Techno", "Private"],
        tablesAvailable: false,
        description: "An exclusive heritage estate turned into a late-night sonic paradise.",
        rules: ["Guestlist only", "Formal valid ID required"],
        dressCode: "Elevated / Black tie optional"
    },
    {
        id: "viman-studio",
        slug: "viman-studio",
        name: "Underground Studio",
        area: "Viman Nagar",
        image: "/events/art-bazaar.svg",
        followers: 5200,
        tags: ["Underground", "Afro", "Art"],
        tablesAvailable: true,
        description: "Industrial space dedicated to the warehouse sound and immersive AV.",
        rules: ["Zero tolerance for harassment", "No flash photography"],
        dressCode: "All black / Streetwear"
    }
];

const VENUES_COLLECTION = "venues";

export async function listVenues({ area, vibe, search, tablesOnly } = {}) {
    if (!isFirebaseConfigured()) {
        let venues = [...fallbackVenues];
        if (area) venues = venues.filter(v => v.area.toLowerCase().includes(area.toLowerCase()));
        if (vibe) venues = venues.filter(v => v.tags.some(t => t.toLowerCase() === vibe.toLowerCase()));
        if (search) {
            const lowSearch = search.toLowerCase();
            venues = venues.filter(v =>
                v.name.toLowerCase().includes(lowSearch) ||
                v.area?.toLowerCase().includes(lowSearch) ||
                v.neighborhood?.toLowerCase().includes(lowSearch)
            );
        }
        if (tablesOnly) venues = venues.filter(v => v.tablesAvailable);
        return venues;
    }

    const db = getAdminDb();
    let query = db.collection(VENUES_COLLECTION);

    if (area) query = query.where("area", "==", area);

    const snapshot = await query.get();
    let venues = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (vibe) {
        venues = venues.filter(v => v.tags.some(t => t.toLowerCase() === vibe.toLowerCase()));
    }

    if (search) {
        const lowSearch = search.toLowerCase();
        venues = venues.filter(v =>
            v.name?.toLowerCase().includes(lowSearch) ||
            v.area?.toLowerCase().includes(lowSearch) ||
            v.neighborhood?.toLowerCase().includes(lowSearch)
        );
    }

    if (tablesOnly) {
        venues = venues.filter(v => v.tablesAvailable);
    }

    if (venues.length === 0 && !area && !vibe && !search) return fallbackVenues;
    return venues;
}

export async function getVenueBySlug(slug) {
    if (!slug) return null;

    if (!isFirebaseConfigured()) {
        return fallbackVenues.find(v => v.slug === slug) || null;
    }

    const db = getAdminDb();
    const snapshot = await db.collection(VENUES_COLLECTION).where("slug", "==", slug).limit(1).get();

    if (!snapshot.empty) {
        return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
    }

    return fallbackVenues.find(v => v.slug === slug) || null;
}

/**
 * Follow a venue (Atomic operation)
 */
export async function followVenue(venueId, userId) {
    if (!isFirebaseConfigured() || !venueId || !userId) return;

    const db = getAdminDb();
    const FieldValue = require("firebase-admin/firestore").FieldValue;

    const followId = `${venueId}_${userId}`;
    const followRef = db.collection("venue_follows").doc(followId);

    const doc = await followRef.get();
    if (doc.exists) return; // Already following

    await db.runTransaction(async (t) => {
        t.set(followRef, {
            venueId,
            userId,
            createdAt: FieldValue.serverTimestamp()
        });
        t.update(db.collection(VENUES_COLLECTION).doc(venueId), {
            followers: FieldValue.increment(1)
        });
    });
}

/**
 * Unfollow a venue
 */
export async function unfollowVenue(venueId, userId) {
    if (!isFirebaseConfigured() || !venueId || !userId) return;

    const db = getAdminDb();
    const FieldValue = require("firebase-admin/firestore").FieldValue;

    const followId = `${venueId}_${userId}`;
    const followRef = db.collection("venue_follows").doc(followId);

    const doc = await followRef.get();
    if (!doc.exists) return;

    await db.runTransaction(async (t) => {
        t.delete(followRef);
        t.update(db.collection(VENUES_COLLECTION).doc(venueId), {
            followers: FieldValue.increment(-1)
        });
    });
}

/**
 * Check if user follows a venue
 */
export async function isFollowingVenue(venueId, userId) {
    if (!isFirebaseConfigured() || !venueId || !userId) return false;
    const db = getAdminDb();
    const followId = `${venueId}_${userId}`;
    const doc = await db.collection("venue_follows").doc(followId).get();
    return doc.exists;
}
