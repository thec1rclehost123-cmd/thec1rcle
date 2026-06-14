import { getAdminDb, isFirebaseConfigured } from "@/lib/firebase/admin";

export type PartnerEntityType = "venue" | "host" | "promoter";

export interface PartnerEventSummary {
    id: string;
    title: string;
    dateIso: string | null;
    dateLabel: string;
    imageUrl: string;
    venueName: string;
    city: string;
    lifecycle: string;
}

export interface PartnerProfileSummary {
    id: string;
    type: PartnerEntityType;
    name: string;
    legalName: string;
    bio: string;
    city: string;
    area: string;
    locationLabel: string;
    phone: string;
    email: string;
    avatarUrl: string;
    coverImageUrl: string;
    website: string;
    socialLinks: Record<string, string>;
    isVerified: boolean;
    memberSinceLabel: string;
    stats: {
        totalEvents: number;
        upcomingEvents: number;
        pastEvents: number;
        contactPoints: number;
    };
    upcomingEvents: PartnerEventSummary[];
    pastEvents: PartnerEventSummary[];
}

export interface PartnerCardSnapshot {
    avatar: string;
    isVerified: boolean;
    eventsCount: number;
    followersCount: number;
    city: string;
}

type PartnerDocResult = {
    id: string;
    type: PartnerEntityType;
    doc: Record<string, any>;
};

const COLLECTIONS: Record<PartnerEntityType, string> = {
    venue: "venues",
    host: "hosts",
    promoter: "promoters",
};

function toIso(value: any): string | null {
    if (!value) return null;
    if (typeof value?.toDate === "function") return value.toDate().toISOString();
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "string") {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    }
    return null;
}

function toDate(value: any): Date | null {
    const iso = toIso(value);
    return iso ? new Date(iso) : null;
}

function compactLocation(city: string, area: string) {
    return [city, area].filter(Boolean).join(", ");
}

function pickString(...values: any[]) {
    for (const value of values) {
        if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
}

function pickNumber(...values: any[]) {
    for (const value of values) {
        const numericValue = typeof value === "number" ? value : Number(value);
        if (Number.isFinite(numericValue)) return numericValue;
    }
    return 0;
}

function cleanLinkValue(value: any) {
    if (typeof value !== "string") return "";
    return value.trim();
}

function normalizeSocialLinks(...sources: any[]) {
    const entries: Record<string, string> = {};

    for (const source of sources) {
        if (!source || typeof source !== "object") continue;
        for (const [key, value] of Object.entries(source)) {
            const normalizedValue = cleanLinkValue(value);
            if (!normalizedValue) continue;
            entries[key] = normalizedValue;
        }
    }

    return entries;
}

function normalizeEvent(doc: Record<string, any>) {
    const startDate = toDate(doc.startDate || doc.date || doc.eventDate);
    return {
        id: String(doc.id || ""),
        title: pickString(doc.title, doc.eventName, doc.name, "Untitled Event"),
        dateIso: startDate?.toISOString() || null,
        dateLabel: startDate
            ? startDate.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
            })
            : "Date TBA",
        imageUrl: pickString(
            doc.image,
            doc.coverImage,
            doc.poster,
            doc.bannerImage,
            doc.heroImage,
        ),
        venueName: pickString(doc.venueName, doc.venue, doc.locationName),
        city: pickString(doc.city, doc.cityName),
        lifecycle: pickString(doc.lifecycle, doc.status, "scheduled"),
    } satisfies PartnerEventSummary;
}

function parseOnboardingEvents(value: any, lifecycle: string) {
    const entries = Array.isArray(value)
        ? value
        : typeof value === "string"
            ? value.split("\n")
            : [];

    return entries
        .map((entry: any, index: number) => {
            if (!entry) return null;

            if (typeof entry === "object" && !Array.isArray(entry)) {
                const title = pickString(entry.title, entry.name);
                if (!title) return null;

                const date = toDate(entry.dateIso || entry.date || entry.startDate);
                return {
                    id: `onboarding-${lifecycle}-${index}`,
                    title,
                    dateIso: date?.toISOString() || null,
                    dateLabel: date
                        ? date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                        : lifecycle === "completed"
                            ? "Completed event"
                            : "Upcoming event",
                    imageUrl: "",
                    venueName: pickString(entry.venueName, entry.venue),
                    city: pickString(entry.city),
                    lifecycle,
                } satisfies PartnerEventSummary;
            }

            const line = String(entry).trim();
            if (!line) return null;

            const [rawTitle, rawDate, rawVenue, rawCity] = line.split("|").map((part) => part.trim());
            const title = pickString(rawTitle);
            if (!title) return null;

            const parsedDate = rawDate ? new Date(rawDate) : null;
            const validDate = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null;

            return {
                id: `onboarding-${lifecycle}-${index}`,
                title,
                dateIso: validDate?.toISOString() || null,
                dateLabel: validDate
                    ? validDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                    : lifecycle === "completed"
                        ? "Completed event"
                        : "Upcoming event",
                imageUrl: "",
                venueName: pickString(rawVenue),
                city: pickString(rawCity),
                lifecycle,
            } satisfies PartnerEventSummary;
        })
        .filter(Boolean) as PartnerEventSummary[];
}

async function getLatestOnboarding(uid: string) {
    if (!uid || !isFirebaseConfigured()) return null;

    const db = getAdminDb();
    const snapshot = await db
        .collection("onboarding_requests")
        .where("uid", "==", uid)
        .limit(10)
        .get();

    if (snapshot.empty) return null;

    const sorted = snapshot.docs
        .map((doc: any) => ({ id: doc.id, ...doc.data() }))
        .sort((left: any, right: any) => {
            const leftTime = toDate(left.updatedAt || left.submittedAt)?.getTime() || 0;
            const rightTime = toDate(right.updatedAt || right.submittedAt)?.getTime() || 0;
            return rightTime - leftTime;
        });

    return sorted[0] as Record<string, any>;
}

async function resolveByQuery(id: string) {
    if (!isFirebaseConfigured()) return null;

    const db = getAdminDb();
    const fallbackQueries: Array<{
        type: PartnerEntityType;
        field: string;
    }> = [
        { type: "venue", field: "ownerId" },
        { type: "venue", field: "uid" },
        { type: "host", field: "uid" },
        { type: "host", field: "userId" },
        { type: "promoter", field: "uid" },
        { type: "promoter", field: "userId" },
    ];

    for (const query of fallbackQueries) {
        const snapshot = await db.collection(COLLECTIONS[query.type]).where(query.field, "==", id).limit(1).get();
        if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            return { id: doc.id, type: query.type, doc: doc.data() as Record<string, any> };
        }
    }

    return null;
}

export async function resolvePartnerDocument(id: string): Promise<PartnerDocResult | null> {
    if (!id || !isFirebaseConfigured()) return null;

    const db = getAdminDb();
    const docs = await Promise.all(
        (Object.keys(COLLECTIONS) as PartnerEntityType[]).map(async (type) => {
            const snapshot = await db.collection(COLLECTIONS[type]).doc(id).get();
            if (!snapshot.exists) return null;
            return { id: snapshot.id, type, doc: snapshot.data() as Record<string, any> };
        })
    );

    return docs.find(Boolean) || await resolveByQuery(id);
}

async function fetchEventsForPartner(partnerId: string, partnerType: PartnerEntityType) {
    if (!isFirebaseConfigured()) return [];

    const db = getAdminDb();

    if (partnerType === "promoter") {
        const assignmentsSnap = await db
            .collection("promoter_assignments")
            .where("promoterId", "==", partnerId)
            .limit(100)
            .get();

        const assignments = assignmentsSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
        const eventIds = Array.from(new Set(assignments.map((item: any) => item.eventId).filter(Boolean)));

        const eventDocs = await Promise.all(
            eventIds.map(async (eventId) => {
                const snapshot = await db.collection("events").doc(String(eventId)).get();
                if (!snapshot.exists) return null;
                return { id: snapshot.id, ...snapshot.data() };
            })
        );

        return eventDocs.filter(Boolean) as Record<string, any>[];
    }

    const field = partnerType === "venue" ? "venueId" : "hostId";
    const snapshot = await db.collection("events").where(field, "==", partnerId).limit(100).get();
    return snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
}

export async function getConnectionForViewer(params: {
    viewerRole?: string;
    viewerId?: string;
    partnerId: string;
    partnerType: PartnerEntityType;
}) {
    const { viewerRole, viewerId, partnerId, partnerType } = params;
    if (!viewerRole || !viewerId || !isFirebaseConfigured()) return null;

    const db = getAdminDb();

    if (
        (viewerRole === "venue" && partnerType === "host") ||
        (viewerRole === "host" && partnerType === "venue")
    ) {
        const venueId = viewerRole === "venue" ? viewerId : partnerId;
        const hostId = viewerRole === "host" ? viewerId : partnerId;
        const snapshot = await db.collection("partnerships")
            .where("venueId", "==", venueId)
            .where("hostId", "==", hostId)
            .limit(1)
            .get();
        if (!snapshot.empty) return { id: snapshot.docs[0].id, ...snapshot.docs[0].data(), type: "partnership" };
    }

    const promoterId = viewerRole === "promoter" ? viewerId : partnerType === "promoter" ? partnerId : "";
    const targetId = viewerRole === "promoter" ? partnerId : viewerId;

    if (promoterId && targetId) {
        const snapshot = await db.collection("promoter_connections")
            .where("promoterId", "==", promoterId)
            .where("targetId", "==", targetId)
            .limit(1)
            .get();
        if (!snapshot.empty) return { id: snapshot.docs[0].id, ...snapshot.docs[0].data(), type: "promoter_connection" };
    }

    return null;
}

export async function getPartnerProfileSummary(id: string): Promise<PartnerProfileSummary | null> {
    const resolved = await resolvePartnerDocument(id);
    if (!resolved) return null;

    const { type, doc } = resolved;
    const ownerUid = pickString(doc.uid, doc.userId, doc.ownerId, resolved.id);

    const [userSnap, onboarding, eventDocs] = await Promise.all([
        ownerUid && isFirebaseConfigured()
            ? getAdminDb().collection("users").doc(ownerUid).get()
            : Promise.resolve(null),
        getLatestOnboarding(ownerUid),
        fetchEventsForPartner(resolved.id, type),
    ]);

    const userData = userSnap?.exists ? (userSnap.data() as Record<string, any>) : {};
    const onboardingData = (onboarding?.data || onboarding || {}) as Record<string, any>;
    const socialLinks = normalizeSocialLinks(
        onboardingData.socialLinks,
        doc.socialLinks,
        {
            instagram: pickString(doc.instagram, doc.instagramHandle, onboardingData.instagram),
            x: pickString(doc.x, doc.twitter, doc.twitterHandle, onboardingData.twitter),
            website: pickString(doc.website, onboardingData.website),
            spotify: pickString(doc.spotify, onboardingData.spotify),
            phone: pickString(doc.phone, onboardingData.phone),
            email: pickString(doc.email, userData.email, onboardingData.email),
        },
    );

    const normalizedEvents = eventDocs
        .map(normalizeEvent)
        .filter((event: any) => event.id && event.title)
        .sort((left: any, right: any) => {
            const leftTime = left.dateIso ? new Date(left.dateIso).getTime() : 0;
            const rightTime = right.dateIso ? new Date(right.dateIso).getTime() : 0;
            return leftTime - rightTime;
        });

    const now = Date.now();
    const manualUpcomingEvents = parseOnboardingEvents(
        onboardingData.upcomingEventsText || onboardingData.upcomingEvents,
        "scheduled",
    );
    const manualPastEvents = parseOnboardingEvents(
        onboardingData.pastEventsText || onboardingData.pastEvents,
        "completed",
    );

    const liveUpcomingEvents = normalizedEvents
        .filter((event: any) => !event.dateIso || new Date(event.dateIso).getTime() >= now)
        .slice(0, 6);
    const livePastEvents = normalizedEvents
        .filter((event: any) => event.dateIso && new Date(event.dateIso).getTime() < now)
        .reverse()
        .slice(0, 8);

    const upcomingEvents = liveUpcomingEvents.length ? liveUpcomingEvents : manualUpcomingEvents.slice(0, 6);
    const pastEvents = livePastEvents.length ? livePastEvents : manualPastEvents.slice(0, 8);

    const createdAt = toDate(doc.createdAt || doc.submittedAt || userData.createdAt || onboarding?.submittedAt);
    const contactPoints = [
        pickString(doc.email, userData.email, onboardingData.email),
        pickString(doc.phone, doc.contactPhone, onboardingData.phone, userData.phoneNumber),
        pickString(doc.website, onboardingData.website),
        ...Object.values(socialLinks || {}),
    ].filter(Boolean).length;
    const totalEvents = normalizedEvents.length || (manualUpcomingEvents.length + manualPastEvents.length);

    return {
        id: resolved.id,
        type,
        name: pickString(
            doc.displayName,
            doc.name,
            doc.brandName,
            doc.venueName,
            onboardingData.name,
            userData.displayName,
            "Unknown Partner",
        ),
        legalName: pickString(doc.legalName, doc.name, onboardingData.contactPerson, onboardingData.name),
        bio: pickString(doc.bio, doc.description, doc.summary, onboardingData.bio),
        city: pickString(doc.city, onboardingData.city),
        area: pickString(doc.area, onboardingData.area),
        locationLabel: compactLocation(
            pickString(doc.city, onboardingData.city),
            pickString(doc.area, onboardingData.area),
        ),
        phone: pickString(doc.phone, doc.contactPhone, onboardingData.phone, userData.phoneNumber),
        email: pickString(doc.email, userData.email, onboardingData.email),
        avatarUrl: pickString(
            doc.profileImage,
            doc.avatar,
            doc.avatarUrl,
            doc.photoURL,
            doc.photoUrl,
            doc.logoUrl,
            doc.logoImage,
            doc.logo,
        ),
        coverImageUrl: pickString(doc.coverImage, doc.bannerImage, doc.heroImage),
        website: pickString(doc.website, onboardingData.website),
        socialLinks,
        isVerified: Boolean(
            doc.isVerified ||
            doc.isApproved ||
            userData.isApproved ||
            onboarding?.status === "approved" ||
            onboarding?.status === "verified" ||
            doc.status === "active"
        ),
        memberSinceLabel: createdAt
            ? createdAt.toLocaleDateString("en-US", { month: "short", year: "numeric" })
            : "",
        stats: {
            totalEvents: pickNumber(doc.eventsCount, totalEvents),
            upcomingEvents: upcomingEvents.length,
            pastEvents: pastEvents.length,
            contactPoints,
        },
        upcomingEvents,
        pastEvents,
    };
}

export async function getPartnerCardSnapshot(id: string): Promise<PartnerCardSnapshot | null> {
    const [resolved, summary] = await Promise.all([
        resolvePartnerDocument(id),
        getPartnerProfileSummary(id),
    ]);
    if (!resolved) return null;

    const { doc } = resolved;
    return {
        avatar: pickString(
            doc.profileImage,
            doc.avatar,
            doc.avatarUrl,
            doc.photoURL,
            doc.photoUrl,
            doc.logoUrl,
            doc.logoImage,
            doc.logo,
        ),
        isVerified: Boolean(doc.isVerified || doc.isApproved || doc.status === "active"),
        eventsCount: pickNumber(summary?.stats.totalEvents, doc.eventsCount),
        followersCount: pickNumber(doc.followersCount, doc.followers, doc.totalFollowers),
        city: pickString(summary?.city, doc.city),
    };
}
