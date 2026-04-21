import type { Firestore } from 'firebase-admin/firestore';
import { EVENT_LIFECYCLE, PUBLIC_LIFECYCLE_STATES, mapEventForClient, normalizeCity } from '@c1rcle/core/events';
import { getEventInterested } from '@c1rcle/core/guest-event-conversion';

type ListParams = Record<string, any>;

const EVENT_CARD_INDEX = 'event_card_index';
const EVENT_CARD_INDEX_VERSION = 2;
const EVENT_CARD_BACKFILL_LIMIT = 1000;
const HOST_SUMMARY = 'host_summary';
const VENUE_SUMMARY = 'venue_summary';
const PROFILE_HIGHLIGHTS = 'profile_highlights';
const PROFILE_STATS = 'profile_stats';
const PROFILE_POSTS = 'profile_posts';
const VENUE_MENU = 'venue_menu';

function toIso(value: any): string | null {
    if (!value) return null;
    if (typeof value === 'string') return value;
    if (typeof value?.toDate === 'function') return value.toDate().toISOString();
    if (value instanceof Date) return value.toISOString();
    return null;
}

function slugify(value: string) {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function normalizeFilterKey(value: any) {
    return slugify(String(value || ''));
}

function normalizeCityKey(value: any) {
    if (!value) return null;
    const normalized = normalizeCity(String(value));
    return normalized === 'other-in' ? normalizeFilterKey(value) : normalized;
}

function normalizeBoolean(value: any) {
    return value === true || String(value || '').toLowerCase() === 'true';
}

function normalizeEventSort(value: any) {
    const normalized = String(value || 'startAt').trim().toLowerCase();
    if (['heat', 'heatscore', 'trending', 'popular'].includes(normalized)) return 'heatScore';
    if (['new', 'newest', 'publishedat', 'createdat'].includes(normalized)) return 'publishedAt';
    if (['price', 'price low to high', 'pricemin'].includes(normalized)) return 'priceMin';
    return 'startAt';
}

function normalizeDiscoverySort(value: any) {
    const normalized = String(value || 'followersCount').trim().toLowerCase();
    if (['soonest event', 'soonest', 'nexteventat'].includes(normalized)) return 'nextEventAt';
    if (['new', 'newest', 'updatedat'].includes(normalized)) return 'updatedAt';
    return 'followersCount';
}

function isPublicProfileEnabled(entity: Record<string, any>) {
    if (!entity) return false;
    if (typeof entity.publicProfileEnabled === 'boolean') return entity.publicProfileEnabled;
    if (typeof entity.presenceConfig?.publicProfileEnabled === 'boolean') return entity.presenceConfig.publicProfileEnabled;
    const visibility = String(entity.visibility || 'public').toLowerCase();
    return visibility === 'public';
}

function serializeDoc(doc: any) {
    const data = doc.data() || {};
    const output: Record<string, any> = { id: doc.id };
    for (const [key, value] of Object.entries(data)) {
        output[key] = Array.isArray(value)
            ? value.map((entry) => (entry && typeof (entry as any).toDate === 'function' ? (entry as any).toDate().toISOString() : entry))
            : value && typeof (value as any).toDate === 'function'
                ? (value as any).toDate().toISOString()
                : value;
    }
    return output;
}

function toEventBoundaryTime(value: any, boundary: 'start' | 'end') {
    const iso = toIso(value);
    if (!iso) return 0;
    const normalized = /^\d{4}-\d{2}-\d{2}$/.test(iso)
        ? `${iso}T${boundary === 'end' ? '23:59:59.999' : '00:00:00.000'}Z`
        : iso;
    const time = new Date(normalized).getTime();
    return Number.isNaN(time) ? 0 : time;
}

function isCurrentOrUpcomingEvent(event: Record<string, any>) {
    const endAt = toEventBoundaryTime(event.endAt || event.endDate || event.startAt || event.startDate, 'end');
    return !endAt || endAt >= Date.now();
}

function normalizeStatusKey(event: Record<string, any>) {
    const raw = String(event.status || event.lifecycle || '').toLowerCase();
    if (raw.includes('cancel')) return 'canceled';
    const startAt = toEventBoundaryTime(event.startAt || event.startDate, 'start');
    const endAt = toEventBoundaryTime(event.endAt || event.endDate || event.startAt || event.startDate, 'end');
    const now = Date.now();
    if (endAt && endAt < now) return 'ended';
    if (startAt && startAt <= now && (!endAt || endAt >= now)) return 'live';
    return 'upcoming';
}

function isEventPublic(event: Record<string, any>) {
    const visibility = String(event.visibility || 'public').toLowerCase();
    const status = String(event.status || event.lifecycle || '').toLowerCase();
    if (visibility !== 'public') return false;
    if (['draft', 'rejected', 'blocked', 'internal'].includes(status)) return false;
    return true;
}

function isGuestDiscoveryVisible(event: Record<string, any>) {
    const lifecycle = String(event.lifecycle || event.status || '').toLowerCase();
    const statusKey = String(event.statusKey || '').toLowerCase();
    if (!event || event.visibility !== 'public') return false;
    if (!PUBLIC_LIFECYCLE_STATES.includes(lifecycle)) return false;
    if (statusKey === 'ended') return false;
    return true;
}

function isEventDetailVisible(event: Record<string, any>) {
    const visibility = String(event.visibility || 'public').toLowerCase();
    const lifecycle = String(event.lifecycle || event.status || '').toLowerCase();
    if (visibility !== 'public') return false;
    return [
        ...PUBLIC_LIFECYCLE_STATES,
        EVENT_LIFECYCLE.CANCELLED,
        EVENT_LIFECYCLE.PAUSED,
        EVENT_LIFECYCLE.COMPLETED,
    ].includes(lifecycle);
}

function computeHeatScore(event: Record<string, any>) {
    const stats = event.stats || {};
    const followers = Number(event.followersCount || 0);
    const views = Number(stats.views || event.views || 0);
    const rsvps = Number(stats.rsvps || stats.interested || event.attendeeCount || 0);
    const ticketSales = Number(stats.ticketSales || stats.orders || 0);
    const startAt = new Date(event.startAt || event.startDate || Date.now()).getTime();
    const hoursUntil = Math.max(1, (startAt - Date.now()) / (1000 * 60 * 60));
    const freshness = hoursUntil < 48 ? 30 : hoursUntil < 168 ? 15 : 5;
    return Math.round(followers * 0.1 + views * 0.05 + rsvps * 2 + ticketSales * 4 + freshness);
}

function buildSearchText(parts: Array<string | null | undefined>) {
    return parts.filter(Boolean).join(' ').toLowerCase();
}

function derivePriceRange(rawEvent: Record<string, any>, priceMin: number, priceMax: number) {
    if (rawEvent.priceRange && typeof rawEvent.priceRange === 'object') {
        return rawEvent.priceRange;
    }
    return {
        min: priceMin,
        max: priceMax,
        currency: rawEvent.currency || 'INR',
    };
}

function deriveTickets(rawEvent: Record<string, any>, priceMin: number) {
    if (Array.isArray(rawEvent.tickets) && rawEvent.tickets.length > 0) {
        return rawEvent.tickets;
    }
    return [
        {
            id: `${rawEvent.id || rawEvent.slug || 'event'}-default`,
            name: rawEvent.isFree || priceMin <= 0 ? 'Free Entry' : 'General Admission',
            price: priceMin,
            quantity: Number(rawEvent.capacity || 0),
        },
    ];
}

function extractStartTime(value: string | null) {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return '';
    return parsed.toISOString().slice(11, 16);
}

function paginateItems<T>(items: T[], limit: number, cursor?: string | null) {
    const start = cursor ? Math.max(items.findIndex((item: any) => item.id === cursor) + 1, 0) : 0;
    const slice = items.slice(start, start + limit);
    const nextCursor = slice.length === limit ? (slice[slice.length - 1] as any)?.id || null : null;
    return {
        items: slice,
        nextCursor,
        hasMore: start + limit < items.length,
    };
}

function dedupeById<T extends Record<string, any>>(items: T[]) {
    const seen = new Set<string>();
    return items.filter((item) => {
        const id = String(item?.id || '');
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
    });
}

function pickAllowed(raw: Record<string, any>, keys: string[]) {
    const output: Record<string, any> = {};
    for (const key of keys) {
        if (raw[key] !== undefined) output[key] = raw[key];
    }
    return output;
}

function projectHostDetail(rawHost: Record<string, any>, summary: Record<string, any>) {
    return {
        ...pickAllowed(rawHost, [
            'id',
            'slug',
            'handle',
            'name',
            'displayName',
            'avatar',
            'photoURL',
            'image',
            'cover',
            'coverURL',
            'bio',
            'description',
            'tagline',
            'role',
            'genres',
            'styleTags',
            'vibes',
            'videos',
            'socialLinks',
            'website',
            'neighborhood',
            'city',
            'location',
            'verified',
            'trending',
            'followers',
            'followersCount',
            'publicProfileEnabled',
            'presenceConfig',
        ]),
        ...summary,
        id: summary.id,
        name: rawHost.name || rawHost.displayName || summary.name || summary.displayName,
        displayName: rawHost.displayName || rawHost.name || summary.displayName || summary.name,
        avatar: rawHost.avatar || rawHost.photoURL || summary.avatar,
        photoURL: rawHost.photoURL || rawHost.avatar || summary.photoURL,
        coverURL: rawHost.coverURL || rawHost.cover || summary.coverURL,
        cover: rawHost.cover || rawHost.coverURL || summary.cover,
        bio: rawHost.bio || rawHost.description || summary.bio,
        description: rawHost.description || rawHost.bio || summary.description,
        followers: Number(rawHost.followers ?? rawHost.followersCount ?? summary.followers ?? summary.followersCount ?? 0),
        followersCount: Number(rawHost.followersCount ?? rawHost.followers ?? summary.followersCount ?? summary.followers ?? 0),
    };
}

function projectVenueDetail(rawVenue: Record<string, any>, summary: Record<string, any>, menuDoc: Record<string, any> | null) {
    const menu = menuDoc?.menu || menuDoc?.items || rawVenue.menu || null;
    return {
        ...pickAllowed(rawVenue, [
            'id',
            'slug',
            'name',
            'displayName',
            'photoURL',
            'logo',
            'image',
            'coverURL',
            'coverImage',
            'bannerImage',
            'venueType',
            'category',
            'type',
            'area',
            'neighborhood',
            'city',
            'address',
            'contact',
            'phone',
            'email',
            'whatsapp',
            'website',
            'socialLinks',
            'coordinates',
            'location',
            'timings',
            'openingHours',
            'costForTwo',
            'averageCost',
            'priceBand',
            'genres',
            'musicGenres',
            'dressCode',
            'entryRules',
            'rules',
            'ageLimit',
            'minimumAge',
            'facilities',
            'amenities',
            'photos',
            'gallery',
            'menuImages',
            'menu',
            'presenceConfig',
            'tablesAvailable',
            'hasReservation',
            'hasTickets',
            'primaryCta',
            'followers',
            'followersCount',
            'verified',
            'isVerified',
            'tags',
            'vibes',
            'bio',
            'description',
            'publicProfileEnabled',
        ]),
        ...summary,
        id: summary.id,
        name: rawVenue.name || summary.name,
        photoURL: rawVenue.photoURL || rawVenue.logo || summary.photoURL,
        image: rawVenue.image || rawVenue.coverURL || rawVenue.coverImage || summary.image,
        coverURL: rawVenue.coverURL || rawVenue.coverImage || rawVenue.image || summary.coverURL,
        coverImage: rawVenue.coverImage || rawVenue.coverURL || rawVenue.image || summary.coverImage,
        area: rawVenue.area || rawVenue.neighborhood || summary.area,
        neighborhood: rawVenue.neighborhood || rawVenue.area || summary.neighborhood,
        followers: Number(rawVenue.followers ?? rawVenue.followersCount ?? summary.followers ?? summary.followersCount ?? 0),
        followersCount: Number(rawVenue.followersCount ?? rawVenue.followers ?? summary.followersCount ?? summary.followers ?? 0),
        verified: Boolean(rawVenue.verified ?? rawVenue.isVerified ?? summary.verified),
        isVerified: Boolean(rawVenue.isVerified ?? rawVenue.verified ?? summary.isVerified),
        menu,
        menuDoc,
    };
}

class EventCardIndexRepository {
    constructor(private db: Firestore) {}

    async listAll() {
        const snapshot = await this.db.collection(EVENT_CARD_INDEX).get();
        return snapshot.docs.map(serializeDoc);
    }

    async getByIdOrSlug(idOrSlug: string) {
        const direct = await this.db.collection(EVENT_CARD_INDEX).doc(idOrSlug).get();
        if (direct.exists) return serializeDoc(direct);
        const slugSnap = await this.db.collection(EVENT_CARD_INDEX).where('slug', '==', idOrSlug).limit(1).get();
        if (!slugSnap.empty) return serializeDoc(slugSnap.docs[0]);
        return null;
    }

    async upsert(id: string, data: Record<string, any>) {
        await this.db.collection(EVENT_CARD_INDEX).doc(id).set(data, { merge: true });
    }

    async delete(id: string) {
        await this.db.collection(EVENT_CARD_INDEX).doc(id).delete().catch(() => undefined);
    }
}

class HostSummaryRepository {
    constructor(private db: Firestore) {}

    async listAll() {
        const snapshot = await this.db.collection(HOST_SUMMARY).get();
        return snapshot.docs.map(serializeDoc);
    }

    async getBySlug(slug: string) {
        const direct = await this.db.collection(HOST_SUMMARY).doc(slug).get();
        if (direct.exists) return serializeDoc(direct);
        const slugSnap = await this.db.collection(HOST_SUMMARY).where('slug', '==', slug).limit(1).get();
        if (!slugSnap.empty) return serializeDoc(slugSnap.docs[0]);
        return null;
    }

    async upsert(id: string, data: Record<string, any>) {
        await this.db.collection(HOST_SUMMARY).doc(id).set(data, { merge: true });
    }
}

class VenueSummaryRepository {
    constructor(private db: Firestore) {}

    async listAll() {
        const snapshot = await this.db.collection(VENUE_SUMMARY).get();
        return snapshot.docs.map(serializeDoc);
    }

    async getBySlug(slug: string) {
        const direct = await this.db.collection(VENUE_SUMMARY).doc(slug).get();
        if (direct.exists) return serializeDoc(direct);
        const slugSnap = await this.db.collection(VENUE_SUMMARY).where('slug', '==', slug).limit(1).get();
        if (!slugSnap.empty) return serializeDoc(slugSnap.docs[0]);
        return null;
    }

    async upsert(id: string, data: Record<string, any>) {
        await this.db.collection(VENUE_SUMMARY).doc(id).set(data, { merge: true });
    }
}

export class PublicDiscoveryService {
    private events: EventCardIndexRepository;
    private hosts: HostSummaryRepository;
    private venues: VenueSummaryRepository;
    private eventCardsChecked = false;

    constructor(private db: Firestore) {
        this.events = new EventCardIndexRepository(db);
        this.hosts = new HostSummaryRepository(db);
        this.venues = new VenueSummaryRepository(db);
    }

    async ensureSeeded() {
        console.log('[PublicDiscoveryService] Checking if seeding is required...');
        await Promise.all([
            this.ensureEventCardsSeeded(),
            this.ensureHostSummarySeeded(),
            this.ensureVenueSummarySeeded(),
        ]);
        console.log('[PublicDiscoveryService] Seeding check complete.');
    }

    private async ensureEventCardsSeeded() {
        if (this.eventCardsChecked) return;

        const existingCards = await this.events.listAll();
        const needsBackfill = existingCards.length === 0 || existingCards.some((card) =>
            card.readModelVersion !== EVENT_CARD_INDEX_VERSION ||
            !card.startDate ||
            !card.category ||
            !card.startDateTime
        );

        if (!needsBackfill) {
            this.eventCardsChecked = true;
            return;
        }

        const raw = await this.db.collection('events').limit(EVENT_CARD_BACKFILL_LIMIT).get();
        for (const doc of raw.docs) {
            await this.syncEventReadModels(doc.id);
        }
        this.eventCardsChecked = true;
    }

    private async ensureHostSummarySeeded() {
        const snapshot = await this.db.collection(HOST_SUMMARY).limit(1).get();
        if (!snapshot.empty) return;
        const raw = await this.db.collection('hosts').limit(100).get();
        for (const doc of raw.docs) {
            await this.syncHostReadModels(doc.id);
        }
    }

    private async ensureVenueSummarySeeded() {
        const snapshot = await this.db.collection(VENUE_SUMMARY).limit(1).get();
        if (!snapshot.empty) return;
        const raw = await this.db.collection('venues').limit(100).get();
        for (const doc of raw.docs) {
            await this.syncVenueReadModels(doc.id);
        }
    }

    async syncEventReadModels(eventId: string) {
        const doc = await this.db.collection('events').doc(eventId).get();
        if (!doc.exists) {
            await this.events.delete(eventId);
            return;
        }
        const serialized = serializeDoc(doc);
        const rawEvent = mapEventForClient(doc.data(), doc.id) || serialized;
        const event = { ...serialized, ...rawEvent };
        if (!isEventPublic(event)) {
            await this.events.delete(eventId);
            return;
        }
        const statusKey = normalizeStatusKey(event);
        const cityKey = normalizeCityKey(event.cityKey || event.city || event.cityLabel) || 'unknown-city';
        const areaKey = slugify(event.area || event.neighborhood || '');
        const title = event.title || event.name || 'Untitled Event';
        const slug = event.slug || slugify(title);
        const priceMin = Number(event.priceMin ?? event.ticketPrice ?? event.minPrice ?? 0);
        const priceMax = Number(event.priceMax ?? event.ticketPrice ?? event.maxPrice ?? priceMin);
        const isFree = Boolean(event.isFree || (priceMin <= 0 && priceMax <= 0));
        const startAt = toIso(event.startAt || event.startDate || event.startDateTime);
        const endAt = toIso(event.endAt || event.endDate);
        const tickets = deriveTickets(event, priceMin);
        const priceRange = derivePriceRange(event, priceMin, priceMax);
        const card = {
            eventId: event.id,
            id: event.id,
            slug,
            title,
            cityKey,
            cityLabel: event.city || event.cityLabel || null,
            areaKey,
            startAt,
            endAt,
            dayKey: startAt?.slice(0, 10) || null,
            lifecycle: event.lifecycle || event.status || 'scheduled',
            visibility: 'public',
            posterUrl: event.poster || event.image || event.coverImage || null,
            image: event.poster || event.image || event.coverImage || null,
            hostId: event.hostId || null,
            hostName: event.hostName || event.host || null,
            hostSlug: event.hostSlug || slugify(event.hostName || event.host || ''),
            venueId: event.venueId || null,
            venueName: event.venueName || event.venue || null,
            venueSlug: event.venueSlug || slugify(event.venueName || event.venue || ''),
            venue: event.venueName || event.venue || null,
            host: event.hostName || event.host || null,
            priceMin,
            priceMax,
            isFree,
            price: priceMin,
            startingPrice: priceMin,
            priceRange,
            tickets,
            availabilityLabel: event.availabilityLabel || (statusKey === 'canceled' ? 'Canceled' : isFree ? 'Free entry' : 'Tickets available'),
            tags: Array.isArray(event.tags) ? event.tags.slice(0, 8) : [],
            eventType: event.eventType || event.category || null,
            curatedCategory: event.curatedCategory || event.category || null,
            category: event.category || event.curatedCategory || event.eventType || 'Event',
            heatScore: computeHeatScore(event),
            searchText: buildSearchText([title, event.hostName, event.host, event.venueName, event.venue, event.city, ...(event.tags || [])]),
            publishedAt: toIso(event.publishedAt || event.updatedAt || event.createdAt),
            updatedAt: new Date().toISOString(),
            statusKey,
            description: event.description || event.summary || '',
            summary: event.summary || event.description || '',
            location: event.location || event.venueName || event.venue || event.cityLabel || '',
            city: event.city || event.cityLabel || null,
            date: typeof event.date === 'string' && event.date.trim() ? event.date : startAt || null,
            time: event.time || event.startTime || extractStartTime(startAt),
            startDate: toIso(event.startDate || event.startDateTime || event.startAt) || startAt,
            endDate: toIso(event.endDate || event.endAt) || endAt,
            startDateTime: toIso(event.startDateTime || event.startDate || event.startAt) || startAt,
            startTime: event.startTime || event.time || extractStartTime(startAt),
            endTime: event.endTime || extractStartTime(endAt),
            guests: Array.isArray(event.guests) ? event.guests : [],
            trending: Boolean(event.trending || computeHeatScore(event) > 40),
            stats: event.stats || {},
            readModelVersion: EVENT_CARD_INDEX_VERSION,
            sourceUpdatedAt: toIso(event.updatedAt || event.createdAt) || null,
        };
        await this.events.upsert(event.id, card);
    }

    async syncHostReadModels(hostId: string) {
        const doc = await this.db.collection('hosts').doc(hostId).get();
        if (!doc.exists) return;
        const host = serializeDoc(doc);
        const slug = host.slug || slugify(host.displayName || host.name || host.handle || host.id);
        const eventCards = (await this.events.listAll()).filter((event) => event.hostId === host.id && event.visibility === 'public');
        const upcoming = eventCards.filter((event) => event.statusKey === 'upcoming').sort((a, b) => String(a.startAt).localeCompare(String(b.startAt)));
        const summary = {
            hostId: host.id,
            id: host.id,
            slug,
            handle: host.handle || `@${slug}`,
            name: host.name || host.displayName || slug,
            displayName: host.displayName || host.name || slug,
            avatar: host.avatar || host.photoURL || host.image || null,
            photoURL: host.photoURL || host.avatar || host.image || null,
            avatarUrl: host.avatar || host.photoURL || host.image || null,
            cover: host.cover || host.coverURL || null,
            coverURL: host.coverURL || host.cover || null,
            coverUrl: host.cover || host.coverURL || null,
            role: host.role || null,
            city: host.city || null,
            neighborhood: host.neighborhood || host.area || null,
            location: host.location || host.city || null,
            cityKey: slugify(host.cityKey || host.city || 'unknown-city'),
            areaKey: slugify(host.area || host.neighborhood || ''),
            vibes: Array.isArray(host.vibes) ? host.vibes : Array.isArray(host.styleTags) ? host.styleTags : [],
            genres: Array.isArray(host.genres) ? host.genres : Array.isArray(host.vibes) ? host.vibes : Array.isArray(host.styleTags) ? host.styleTags : [],
            styleTags: Array.isArray(host.styleTags) ? host.styleTags : Array.isArray(host.vibes) ? host.vibes : [],
            verified: Boolean(host.verified),
            trending: Boolean(host.trending),
            popular: Boolean(host.popular || Number(host.followersCount ?? host.followers ?? 0) >= 1000),
            followers: Number(host.followers ?? host.followersCount ?? 0),
            followersCount: Number(host.followersCount ?? host.followers ?? 0),
            upcomingEventsCount: upcoming.length,
            nextEventDate: upcoming[0]?.startAt || null,
            nextEventAt: upcoming[0]?.startAt || null,
            featuredEventIds: upcoming.slice(0, 3).map((event) => event.id),
            bioShort: host.bio || host.description || null,
            bio: host.bio || host.description || null,
            searchText: buildSearchText([host.displayName, host.name, host.handle, host.city, ...(host.vibes || []), ...(host.styleTags || [])]),
            updatedAt: new Date().toISOString(),
            publicProfileEnabled: host.publicProfileEnabled ?? host.presenceConfig?.publicProfileEnabled ?? true,
            visibility: isPublicProfileEnabled(host) ? 'public' : 'private',
        };
        await this.hosts.upsert(host.id, summary);
    }

    async syncVenueReadModels(venueId: string) {
        const doc = await this.db.collection('venues').doc(venueId).get();
        if (!doc.exists) return;
        const venue = serializeDoc(doc);
        const slug = venue.slug || slugify(venue.name || venue.id);
        const eventCards = (await this.events.listAll()).filter((event) => event.venueId === venue.id && event.visibility === 'public');
        const upcoming = eventCards.filter((event) => event.statusKey === 'upcoming').sort((a, b) => String(a.startAt).localeCompare(String(b.startAt)));
        const menuSnapshot = await this.db.collection(VENUE_MENU).where('venueId', '==', venue.id).limit(1).get().catch(() => null);
        const highlightsSnapshot = await this.db.collection(PROFILE_HIGHLIGHTS).where('profileId', '==', venue.id).where('profileType', '==', 'venue').get().catch(() => null);
        const summary = {
            venueId: venue.id,
            id: venue.id,
            slug,
            name: venue.name || slug,
            displayName: venue.displayName || venue.name || slug,
            photoURL: venue.photoURL || venue.logo || venue.image || null,
            logo: venue.logo || venue.photoURL || null,
            image: venue.image || venue.coverURL || venue.coverImage || null,
            coverURL: venue.coverURL || venue.coverImage || venue.image || null,
            coverImage: venue.coverImage || venue.coverURL || venue.image || null,
            photoUrl: venue.photoURL || venue.image || null,
            coverUrl: venue.coverURL || venue.coverImage || null,
            city: venue.city || null,
            area: venue.area || venue.neighborhood || null,
            neighborhood: venue.neighborhood || venue.area || null,
            cityKey: slugify(venue.cityKey || venue.city || 'unknown-city'),
            areaKey: slugify(venue.area || venue.neighborhood || ''),
            tags: Array.isArray(venue.tags) ? venue.tags : [],
            genres: Array.isArray(venue.genres) ? venue.genres : Array.isArray(venue.tags) ? venue.tags : [],
            vibes: Array.isArray(venue.vibes) ? venue.vibes : Array.isArray(venue.tags) ? venue.tags : [],
            tablesAvailable: Boolean(venue.tablesAvailable),
            verified: Boolean(venue.verified),
            isVerified: Boolean(venue.isVerified ?? venue.verified),
            venueType: venue.venueType || venue.category || venue.type || null,
            category: venue.category || venue.venueType || venue.type || null,
            followers: Number(venue.followers ?? venue.followersCount ?? 0),
            followersCount: Number(venue.followersCount ?? venue.followers ?? 0),
            upcomingEventsCount: upcoming.length,
            nextEventAt: upcoming[0]?.startAt || null,
            menuAvailable: Boolean(menuSnapshot && !menuSnapshot.empty),
            highlightsCount: highlightsSnapshot?.size || 0,
            bioShort: venue.bio || venue.description || null,
            bio: venue.bio || venue.description || null,
            description: venue.description || venue.bio || null,
            searchText: buildSearchText([venue.name, venue.city, venue.area, ...(venue.tags || [])]),
            updatedAt: new Date().toISOString(),
            publicProfileEnabled: venue.publicProfileEnabled ?? venue.presenceConfig?.publicProfileEnabled ?? true,
            visibility: isPublicProfileEnabled(venue) ? 'public' : 'private',
        };
        await this.venues.upsert(venue.id, summary);
    }

    async listEvents(query: ListParams) {
        await this.ensureSeeded();
        const limit = Math.min(Math.max(Number(query.limit) || 12, 1), 24);
        const cursor = query.cursor || query.lastId || null;
        const cityKey = normalizeCityKey(query.cityKey || query.city);
        const statusKey = query.statusKey || query.status || null;
        const eventType = query.eventType || query.type || null;
        const search = String(query.search || query.q || '').trim().toLowerCase();
        const host = String(query.host || query.hostId || query.hostSlug || '').trim().toLowerCase();
        const venue = String(query.venue || query.venueId || query.venueSlug || '').trim().toLowerCase();
        let items = await this.events.listAll();
        items = dedupeById(items).filter((item) => item.visibility === 'public');
        if (!statusKey) items = items.filter((item) => isGuestDiscoveryVisible(item));
        if (cityKey) items = items.filter((item) => item.cityKey === cityKey);
        if (statusKey) items = items.filter((item) => item.statusKey === statusKey || String(item.lifecycle || '').toLowerCase() === String(statusKey).toLowerCase());
        if (eventType) items = items.filter((item) => item.eventType === eventType || item.category === eventType);
        if (query.curatedCategory) items = items.filter((item) => item.curatedCategory === query.curatedCategory);
        if (query.priceType === 'free') items = items.filter((item) => item.isFree);
        if (query.priceType === 'paid') items = items.filter((item) => !item.isFree);
        if (query.dayKey) items = items.filter((item) => item.dayKey === query.dayKey);
        if (host) {
            items = items.filter((item) =>
                [item.hostId, item.hostSlug, item.hostName, item.host].some((value) => String(value || '').toLowerCase() === host)
                || String(item.hostName || item.host || '').toLowerCase().includes(host)
            );
        }
        if (venue) {
            items = items.filter((item) =>
                [item.venueId, item.venueSlug, item.venueName, item.venue].some((value) => String(value || '').toLowerCase() === venue)
                || String(item.venueName || item.venue || '').toLowerCase().includes(venue)
            );
        }
        if (search) {
            items = items.filter((item) => String(item.searchText || '').toLowerCase().includes(search));
        }
        const sort = normalizeEventSort(query.sort);
        items.sort((a, b) => {
            if (sort === 'heatScore') return Number(b.heatScore || 0) - Number(a.heatScore || 0);
            if (sort === 'publishedAt') return String(b.publishedAt || '').localeCompare(String(a.publishedAt || ''));
            if (sort === 'priceMin') return Number(a.priceMin || 0) - Number(b.priceMin || 0);
            return String(a.startAt || '').localeCompare(String(b.startAt || ''));
        });
        const page = paginateItems(items, limit, cursor);
        return {
            ...page,
            appliedFilters: {
                cityKey: cityKey || null,
                statusKey: statusKey || null,
                eventType: eventType || null,
                curatedCategory: query.curatedCategory || null,
                priceType: query.priceType || null,
                dayKey: query.dayKey || null,
                search: search || null,
                host: host || null,
                venue: venue || null,
                sort,
            },
        };
    }

    async listFeaturedEvents(query: ListParams = {}) {
        await this.ensureSeeded();
        const limit = Math.min(Math.max(Number(query.limit) || 6, 1), 12);
        const settings = await this.db.collection('platform_settings').doc('spotlights').get().catch(() => null);
        const pinnedIds = Array.isArray(settings?.data?.()?.featured)
            ? settings.data()!.featured.filter((id: any) => typeof id === 'string' && id.trim())
            : [];
        const pinned = (await Promise.all(pinnedIds.map((id: string) => this.events.getByIdOrSlug(id))))
            .filter(Boolean)
            .filter((event: any) => event.visibility === 'public' && isCurrentOrUpcomingEvent(event));
        const heat = (await this.listEvents({ ...query, limit: 24, sort: 'heat' })).items
            .filter((event: any) => isCurrentOrUpcomingEvent(event));
        const seen = new Set();
        const items = [...pinned, ...heat].filter((event: any) => {
            if (!event?.id || seen.has(event.id)) return false;
            seen.add(event.id);
            return true;
        }).slice(0, limit);
        return {
            items,
            nextCursor: null,
            hasMore: false,
            appliedFilters: { sort: 'heatScore' },
        };
    }

    async getEventDetail(idOrSlug: string) {
        await this.ensureSeeded();
        const indexed = await this.events.getByIdOrSlug(idOrSlug);
        let raw = indexed?.id
            ? await this.db.collection('events').doc(indexed.id).get().catch(() => null)
            : null;

        if (!raw?.exists) {
            const direct = await this.db.collection('events').doc(idOrSlug).get().catch(() => null);
            if (direct?.exists) raw = direct;
        }

        if (!raw?.exists) {
            const slugSnap = await this.db.collection('events').where('slug', '==', idOrSlug).limit(1).get().catch(() => null);
            if (slugSnap && !slugSnap.empty) raw = slugSnap.docs[0];
        }

        if (!indexed && !raw?.exists) return null;

        const details = raw?.exists ? mapEventForClient(serializeDoc(raw), raw.id) : {};
        const event = { ...(indexed || {}), ...(details || {}), id: details?.id || indexed?.id };
        if (!event.id || !isEventDetailVisible(event)) return null;

        const interestedData = await getEventInterested(this.db, event.id, 20)
            .catch(() => ({ count: Number(event.stats?.saves || 0), users: [] }));

        return { event, interestedData };
    }

    async listHosts(query: ListParams) {
        await this.ensureSeeded();
        const limit = Math.min(Math.max(Number(query.limit) || 12, 1), 24);
        const cursor = query.cursor || query.lastId || null;
        const cityKey = normalizeCityKey(query.cityKey || query.city);
        const search = String(query.search || query.q || '').trim().toLowerCase();
        const status = String(query.status || '').trim().toLowerCase();
        let items = await this.hosts.listAll();
        items = items.filter((item) => item.visibility === 'public');
        if (cityKey) items = items.filter((item) => item.cityKey === cityKey);
        if (query.role) items = items.filter((item) => String(item.role || '').toLowerCase() === String(query.role).toLowerCase());
        if (query.vibe) items = items.filter((item) => Array.isArray(item.vibes) && item.vibes.some((v: string) => v.toLowerCase() === String(query.vibe).toLowerCase()));
        if (search) items = items.filter((item) => String(item.searchText || '').toLowerCase().includes(search));
        if (normalizeBoolean(query.verified) || status === 'verified') items = items.filter((item) => item.verified);
        if (normalizeBoolean(query.trending) || status === 'trending') items = items.filter((item) => item.trending);
        if (status === 'popular') items = items.filter((item) => item.popular || Number(item.followersCount || item.followers || 0) > 0);
        const sort = normalizeDiscoverySort(query.sort);
        items.sort((a, b) => {
            if (sort === 'nextEventAt') return String(a.nextEventAt || '').localeCompare(String(b.nextEventAt || ''));
            if (sort === 'updatedAt') return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
            return Number(b.followersCount || 0) - Number(a.followersCount || 0);
        });
        const page = paginateItems(items, limit, cursor);
        return {
            ...page,
            appliedFilters: {
                cityKey: cityKey || null,
                role: query.role || null,
                vibe: query.vibe || null,
                verified: query.verified ?? null,
                trending: query.trending ?? null,
                status: query.status || null,
                search: search || null,
                sort,
            },
        };
    }

    async getHostPublicProfile(slug: string) {
        await this.ensureSeeded();
        const host = await this.hosts.getBySlug(slug);
        if (!host) return null;
        const [rawDoc, postsSnap, highlightsSnap, statsSnap, allEvents] = await Promise.all([
            this.db.collection('hosts').doc(host.id).get().catch(() => null),
            this.db.collection(PROFILE_POSTS).where('profileId', '==', host.id).where('profileType', '==', 'host').limit(12).get().catch(() => null),
            this.db.collection(PROFILE_HIGHLIGHTS).where('profileId', '==', host.id).where('profileType', '==', 'host').get().catch(() => null),
            this.db.collection(PROFILE_STATS).doc(`host_${host.id}`).get().catch(() => null),
            this.events.listAll(),
        ]);
        const hostEvents = allEvents.filter((event) => event.hostId === host.id).sort((a, b) => String(a.startAt || '').localeCompare(String(b.startAt || '')));
        const rawHost = rawDoc?.exists ? serializeDoc(rawDoc) : {};
        if (!isPublicProfileEnabled({ ...rawHost, ...host })) return null;
        return {
            host: projectHostDetail(rawHost, host),
            stats: statsSnap?.exists ? serializeDoc(statsSnap) : { followersCount: host.followersCount, upcomingEventsCount: host.upcomingEventsCount },
            posts: postsSnap?.docs?.map(serializeDoc) || [],
            highlights: highlightsSnap?.docs?.map(serializeDoc) || [],
            upcomingEvents: hostEvents.filter((event) => event.statusKey === 'upcoming').slice(0, 6),
            pastEvents: hostEvents.filter((event) => event.statusKey === 'ended').slice(0, 6),
        };
    }

    async listVenues(query: ListParams) {
        await this.ensureSeeded();
        const limit = Math.min(Math.max(Number(query.limit) || 12, 1), 24);
        const cursor = query.cursor || query.lastId || null;
        const cityKey = normalizeCityKey(query.cityKey || query.city);
        const areaKey = query.areaKey || (query.area ? normalizeFilterKey(query.area) : null);
        const search = String(query.search || query.q || '').trim().toLowerCase();
        let items = await this.venues.listAll();
        items = items.filter((item) => item.visibility === 'public');
        if (cityKey) items = items.filter((item) => item.cityKey === cityKey);
        if (areaKey) items = items.filter((item) => item.areaKey === areaKey);
        if (query.vibe) {
            const vibe = String(query.vibe).toLowerCase();
            items = items.filter((item) => [item.tags, item.vibes, item.genres]
                .some((values) => Array.isArray(values) && values.some((v: string) => v.toLowerCase() === vibe)));
        }
        if (search) items = items.filter((item) => String(item.searchText || '').toLowerCase().includes(search));
        if (normalizeBoolean(query.tablesAvailable) || normalizeBoolean(query.tablesOnly)) items = items.filter((item) => item.tablesAvailable);
        if (normalizeBoolean(query.verified)) items = items.filter((item) => item.verified);
        const sort = normalizeDiscoverySort(query.sort);
        items.sort((a, b) => {
            if (sort === 'nextEventAt') return String(a.nextEventAt || '').localeCompare(String(b.nextEventAt || ''));
            if (sort === 'updatedAt') return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
            return Number(b.followersCount || 0) - Number(a.followersCount || 0);
        });
        const page = paginateItems(items, limit, cursor);
        return {
            ...page,
            appliedFilters: {
                cityKey: cityKey || null,
                areaKey: areaKey || null,
                tablesAvailable: query.tablesAvailable ?? query.tablesOnly ?? null,
                verified: query.verified ?? null,
                vibe: query.vibe || null,
                search: search || null,
                sort,
            },
        };
    }

    async getVenuePublicProfile(slug: string) {
        await this.ensureSeeded();
        const venue = await this.venues.getBySlug(slug);
        if (!venue) return null;
        const [rawDoc, highlightsSnap, statsSnap, menuSnap, allEvents, allVenues] = await Promise.all([
            this.db.collection('venues').doc(venue.id).get().catch(() => null),
            this.db.collection(PROFILE_HIGHLIGHTS).where('profileId', '==', venue.id).where('profileType', '==', 'venue').get().catch(() => null),
            this.db.collection(PROFILE_STATS).doc(`venue_${venue.id}`).get().catch(() => null),
            this.db.collection(VENUE_MENU).where('venueId', '==', venue.id).limit(1).get().catch(() => null),
            this.events.listAll(),
            this.venues.listAll(),
        ]);
        const venueEvents = allEvents.filter((event) => event.venueId === venue.id).sort((a, b) => String(a.startAt || '').localeCompare(String(b.startAt || '')));
        const menuDoc = menuSnap && !menuSnap.empty ? serializeDoc(menuSnap.docs[0]) : null;
        const similarVenues = allVenues.filter((item) => item.id !== venue.id && (item.cityKey === venue.cityKey || item.areaKey === venue.areaKey)).slice(0, 6);
        const rawVenue = rawDoc?.exists ? serializeDoc(rawDoc) : {};
        if (!isPublicProfileEnabled({ ...rawVenue, ...venue })) return null;
        return {
            venue: projectVenueDetail(rawVenue, venue, menuDoc),
            stats: statsSnap?.exists ? serializeDoc(statsSnap) : { followers: venue.followersCount, upcomingEventsCount: venue.upcomingEventsCount },
            highlights: highlightsSnap?.docs?.map(serializeDoc) || [],
            upcomingEvents: venueEvents.filter((event) => event.statusKey === 'upcoming').slice(0, 6),
            pastEvents: venueEvents.filter((event) => event.statusKey === 'ended').slice(0, 20),
            similarVenues,
            menu: menuDoc,
        };
    }

    async search(query: string, limit = 6) {
        await this.ensureSeeded();
        const needle = String(query || '').trim().toLowerCase();
        if (!needle) {
            return { events: [], hosts: [], venues: [] };
        }
        const [events, hosts, venues] = await Promise.all([
            this.events.listAll(),
            this.hosts.listAll(),
            this.venues.listAll(),
        ]);
        const score = (haystack: string, secondary = 0) => {
            if (!haystack) return -1;
            if (haystack === needle) return 1000 + secondary;
            if (haystack.startsWith(needle)) return 800 + secondary;
            if (haystack.includes(needle)) return 500 + secondary;
            return -1;
        };
        const rank = <T extends Record<string, any>>(items: T[], text: (item: T) => string, secondary: (item: T) => number) =>
            items
                .map((item) => ({ item, score: score(text(item), secondary(item)) }))
                .filter((entry) => entry.score >= 0)
                .sort((a, b) => b.score - a.score)
                .slice(0, limit)
                .map((entry) => entry.item);

        return {
            events: rank(events.filter((item) => item.visibility === 'public'), (item) => item.searchText || '', (item) => Number(item.heatScore || 0)),
            hosts: rank(hosts.filter((item) => item.visibility === 'public'), (item) => item.searchText || '', (item) => Number(item.followersCount || 0)),
            venues: rank(venues.filter((item) => item.visibility === 'public'), (item) => item.searchText || '', (item) => Number(item.followersCount || 0)),
        };
    }
}
