import { create } from "zustand";
import {
    collection,
    getDocs,
    limit,
    orderBy,
    query,
    where,
} from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase";
import {
    type Coordinates,
    findKnownVenueCoordinates,
    normalizeVenueKey,
    resolveVenueCoordinates,
} from "@/lib/venueDiscovery";

export interface Venue {
    id: string;
    name?: string;
    displayName?: string;
    slug?: string;
    area?: string;
    neighborhood?: string;
    city?: string;
    address?: string;
    image?: string;
    coverURL?: string;
    coverImage?: string;
    photoURL?: string;
    tags?: string[];
    vibes?: string[];
    genres?: string[];
    tablesAvailable?: boolean;
    isVerified?: boolean;
    venueType?: string;
    description?: string;
    whatsapp?: string;
    phone?: string;
    addressLine1?: string;
    bannerImage?: string;
    logoImage?: string;
    followers?: number;
    hasReservation?: boolean;
    coordinates?: Coordinates | null;
    upcomingEventsCount?: number;
    nextEventDate?: string;
    nextEventId?: string;
    nextEventTitle?: string;
    popularityScore?: number;
}

interface VenuesState {
    venues: Venue[];
    loading: boolean;
    error: string | null;
    fetchVenues: (filters?: { area?: string; search?: string; tablesOnly?: boolean }) => Promise<void>;
}

type VenueDocShape = Record<string, unknown> & { id: string };

export const useVenuesStore = create<VenuesState>((set) => ({
    venues: [],
    loading: false,
    error: null,

    fetchVenues: async (filters = {}) => {
        set({ loading: true, error: null });
        try {
            const db = getFirebaseDb();
            let qRef: any = query(collection(db, "venues"));
            if (filters.tablesOnly) {
                qRef = query(qRef, where("tablesAvailable", "==", true));
            }

            const eventsQuery = query(
                collection(db, "events"),
                where("status", "in", ["published", "scheduled", "live"]),
                orderBy("startDate", "asc"),
                limit(150)
            );

            const [snapshot, eventsSnapshot] = await Promise.all([getDocs(qRef), getDocs(eventsQuery)]);

            const venueDocs: VenueDocShape[] = snapshot.docs.map((d) => ({
                id: d.id,
                ...(d.data() as Record<string, unknown>),
            }));

            const venueIdByKey = new Map<string, string>();

            venueDocs.forEach((venue) => {
                const keys = [
                    venue.id,
                    typeof venue.slug === "string" ? venue.slug : undefined,
                    normalizeVenueKey(typeof venue.name === "string" ? venue.name : undefined),
                    normalizeVenueKey(typeof venue.displayName === "string" ? venue.displayName : undefined),
                ].filter((value): value is string => Boolean(value));

                keys.forEach((key) => venueIdByKey.set(key, venue.id));
            });

            const now = Date.now();
            const eventsByVenueId = new Map<
                string,
                { count: number; nextEventDate?: string; nextEventId?: string; nextEventTitle?: string; coordinates?: Coordinates | null }
            >();

            eventsSnapshot.docs.forEach((eventDoc) => {
                const eventData = eventDoc.data() as Record<string, unknown>;
                const startDate = typeof eventData.startDate === "string" ? eventData.startDate : undefined;

                if (!startDate || Number.isNaN(Date.parse(startDate)) || Date.parse(startDate) < now) {
                    return;
                }

                const directVenueId =
                    typeof eventData.venueId === "string"
                        ? eventData.venueId
                        : typeof eventData.venueSlug === "string"
                            ? venueIdByKey.get(normalizeVenueKey(eventData.venueSlug))
                            : venueIdByKey.get(normalizeVenueKey(typeof eventData.venue === "string" ? eventData.venue : undefined));

                if (!directVenueId) {
                    return;
                }

                const current = eventsByVenueId.get(directVenueId) || { count: 0 };
                const eventCoordinates =
                    resolveVenueCoordinates(eventData) ||
                    findKnownVenueCoordinates(
                        typeof eventData.venue === "string" ? eventData.venue : undefined,
                        typeof eventData.location === "string" ? eventData.location : undefined,
                        typeof eventData.city === "string" ? eventData.city : undefined
                    );

                const shouldReplaceLead =
                    !current.nextEventDate || Date.parse(startDate) < Date.parse(current.nextEventDate);

                eventsByVenueId.set(directVenueId, {
                    count: current.count + 1,
                    coordinates: current.coordinates || eventCoordinates,
                    nextEventDate: shouldReplaceLead ? startDate : current.nextEventDate,
                    nextEventId: shouldReplaceLead ? eventDoc.id : current.nextEventId,
                    nextEventTitle:
                        shouldReplaceLead && typeof eventData.title === "string"
                            ? eventData.title
                            : current.nextEventTitle,
                });
            });

            let venues: Venue[] = venueDocs.map((venueDoc) => {
                const relatedEvents = eventsByVenueId.get(venueDoc.id);
                const coordinates =
                    resolveVenueCoordinates(venueDoc) ||
                    relatedEvents?.coordinates ||
                    findKnownVenueCoordinates(
                        typeof venueDoc.displayName === "string" ? venueDoc.displayName : undefined,
                        typeof venueDoc.name === "string" ? venueDoc.name : undefined,
                        typeof venueDoc.neighborhood === "string" ? venueDoc.neighborhood : undefined,
                        typeof venueDoc.area === "string" ? venueDoc.area : undefined,
                        typeof venueDoc.city === "string" ? venueDoc.city : undefined,
                        typeof venueDoc.address === "string" ? venueDoc.address : undefined
                    );

                const followers =
                    typeof venueDoc.followers === "number"
                        ? venueDoc.followers
                        : typeof venueDoc.followersCount === "number"
                            ? venueDoc.followersCount
                            : 0;
                const upcomingEventsCount = relatedEvents?.count || 0;

                return {
                    ...venueDoc,
                    followers,
                    coordinates,
                    hasReservation:
                        Boolean(venueDoc.hasReservation) ||
                        Boolean(venueDoc.tablesAvailable) ||
                        Boolean(venueDoc.whatsapp) ||
                        Boolean(venueDoc.phone),
                    upcomingEventsCount,
                    nextEventDate: relatedEvents?.nextEventDate,
                    nextEventId: relatedEvents?.nextEventId,
                    nextEventTitle: relatedEvents?.nextEventTitle,
                    popularityScore:
                        followers * 2 +
                        upcomingEventsCount * 600 +
                        (venueDoc.tablesAvailable ? 400 : 0) +
                        (venueDoc.isVerified ? 250 : 0),
                } as Venue;
            });

            if (filters.area) {
                const clean = filters.area.toLowerCase().trim();
                venues = venues.filter((v) => {
                    const a = (v.area || "").toLowerCase();
                    const n = (v.neighborhood || "").toLowerCase();
                    const addr = (v.address || "").toLowerCase();
                    const c = (v.city || "").toLowerCase();
                    return a.includes(clean) || n.includes(clean) || addr.includes(clean) || c.includes(clean);
                });
            }

            if (filters.search) {
                const s = filters.search.toLowerCase().trim();
                venues = venues.filter((v) => {
                    const name = (v.displayName || v.name || "").toLowerCase();
                    const a = (v.area || "").toLowerCase();
                    const n = (v.neighborhood || "").toLowerCase();
                    const city = (v.city || "").toLowerCase();
                    const tags = [...(v.tags || []), ...(v.genres || []), ...(v.vibes || [])]
                        .join(" ")
                        .toLowerCase();
                    return name.includes(s) || a.includes(s) || n.includes(s) || city.includes(s) || tags.includes(s);
                });
            }

            set({ venues, loading: false });
        } catch (e: any) {
            set({ error: e?.message || "Failed to fetch venues", loading: false });
        }
    },
}));
