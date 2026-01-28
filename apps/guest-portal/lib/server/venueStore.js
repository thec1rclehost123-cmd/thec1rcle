import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";

const fallbackVenues = [
    {
        id: "high-spirits",
        slug: "high-spirits",
        name: "High Spirits",
        area: "Koregaon Park",
        neighborhood: "Koregaon Park",
        city: "Pune",
        image: "/events/neon-nights.jpg",
        coverURL: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?q=80&w=2070&auto=format&fit=crop",
        photoURL: "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?q=80&w=400&auto=format&fit=crop",
        followers: 12500,
        tags: ["Techno", "Rooftop", "Indie"],
        tablesAvailable: true,
        venueType: "Pub",
        description: "Pune's legendary home for indie music and high energy nights. The venue features an open-air setting with fairy lights and a mix of contemporary and rustic decor.",
        specialty: "High Spirits Cafe in Koregaon Park, Pune, is a popular nightlife spot known for its lively ambiance, live music, and vibrant events like DJ sets and themed parties.",
        timings: {
            "Tuesday": "12PM - 11:45PM",
            "Wednesday": "12PM - 11:45PM",
            "Thursday": "12PM - 11:45PM",
            "Friday": "12PM - 11:45PM",
            "Saturday": "12PM - 11:45PM",
            "Sunday": "12PM - 11:45PM"
        },
        contact: {
            email: "highspiritscafe@gmail.com",
            phone: "9765400484",
            address: "35A, 1, N Main Rd, next to The Westin, Koregaon Park Annexe, Pune, Maharashtra 411001",
            instagram: "highspiritscafe"
        },
        businessDetails: {
            gst: "27AAIPG1015J120",
            fssai: "11521034000388",
            registeredName: "KHODADAD RUSTOM IRANI",
            placeName: "HIGH SPIRITS"
        },
        photos: [
            "https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?q=80&w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1543007630-9710e4a00a20?q=80&w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1470337458703-46ad1756a187?q=80&w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1574096079543-d8839782b604?q=80&w=800&auto=format&fit=crop"
        ],
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

/**
 * Helper to serialize Firestore docs to plain objects for RSC
 */
const serializeDoc = (doc) => {
    if (!doc.exists) return null;
    const data = doc.data();
    const serialized = { id: doc.id, ...data };

    // Convert Timestamps to ISO strings
    Object.keys(serialized).forEach(key => {
        if (serialized[key] && typeof serialized[key].toDate === 'function') {
            serialized[key] = serialized[key].toDate().toISOString();
        }
    });

    return serialized;
};

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
    let venues = snapshot.docs.map(doc => {
        const serialized = serializeDoc(doc);
        return {
            ...serialized,
            slug: serialized.slug || serialized.id
        };
    });

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
        const serialized = serializeDoc(snapshot.docs[0]);
        return { ...serialized, slug: serialized.slug || serialized.id };
    }

    // Try direct ID lookup if slug lookup fails
    try {
        const doc = await db.collection(VENUES_COLLECTION).doc(slug).get();
        if (doc.exists) {
            const serialized = serializeDoc(doc);
            return { ...serialized, slug: serialized.slug || serialized.id };
        }
    } catch (e) { }

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
