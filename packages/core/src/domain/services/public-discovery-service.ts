import { FieldPath, type Firestore } from 'firebase-admin/firestore';
import { mapEventForClient } from '@c1rcle/core/events';
import { getEventInterested } from '@c1rcle/core/guest-event-conversion';
import {
  buildGuestDiscoveryEnvelope,
  buildEventCardReadModel,
  buildHostSummaryReadModel,
  buildVenueSummaryReadModel,
  filterGuestEventCards,
  isCurrentOrUpcomingGuestEvent,
  isGuestEventDetailVisible,
  isGuestEventPublic,
  isGuestPublicProfileEnabled,
  normalizeCityKey,
  normalizeBoolean,
  normalizeDiscoverySort,
  normalizeFilterKey,
  normalizeGuestDiscoveryLimit,
  projectHostDetail as projectGuestHostDetail,
  projectVenueDetail as projectGuestVenueDetail,
  rankGuestSearchGroups,
} from '@c1rcle/core/guest-discovery-engine';
// @ts-ignore
import { bumpCacheVersion } from '@c1rcle/core/redis';

type ListParams = Record<string, any>;

const EVENT_CARD_INDEX = 'event_card_index';
const EVENT_CARD_INDEX_VERSION = 2;
const EVENT_CARD_BACKFILL_BATCH_SIZE = 100;
const HOST_SUMMARY = 'host_summary';
const HOST_SUMMARY_VERSION = 3;
const VENUE_SUMMARY = 'venue_summary';
const VENUE_SUMMARY_VERSION = 3;
const PROFILE_HIGHLIGHTS = 'profile_highlights';
const PROFILE_STATS = 'profile_stats';
const PROFILE_POSTS = 'profile_posts';
const VENUE_MENU = 'venue_menu';
const SYSTEM_META = 'system_meta';
const PUBLIC_DISCOVERY_BOOTSTRAP_DOC = 'public_discovery';

type BootstrapState = {
  eventCardIndexVersion?: number;
  hostSummaryVersion?: number;
  venueSummaryVersion?: number;
  completedAt?: string;
};

type BootstrapLogger = {
  info: (message: string, ...args: any[]) => void;
  error: (message: string, ...args: any[]) => void;
};

type DiscoveryListCursor = {
  mode: 'list';
  value: string | number | null;
  id: string;
};

function derivePublicLifecycleForDetail(event: Record<string, any>, statusKey: string) {
  const rawLifecycle = String(event?.lifecycle || event?.status || '').toLowerCase();
  if (rawLifecycle === 'cancelled' || statusKey === 'canceled') return 'cancelled';
  if (rawLifecycle === 'paused') return 'paused';
  if (statusKey === 'ended') return 'completed';
  if (statusKey === 'live') return 'live';
  return 'scheduled';
}

function serializeDoc(doc: any) {
  const data = doc.data() || {};
  const output: Record<string, any> = { id: doc.id };
  for (const [key, value] of Object.entries(data)) {
    output[key] = Array.isArray(value)
      ? value.map((entry) =>
          entry && typeof (entry as any).toDate === 'function'
            ? (entry as any).toDate().toISOString()
            : entry,
        )
      : value && typeof (value as any).toDate === 'function'
        ? (value as any).toDate().toISOString()
        : value;
  }
  return output;
}

function compareReadModelValues(left: any, right: any) {
  const a = left ?? null;
  const b = right ?? null;
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b));
}

function sortReadModels(
  items: Record<string, any>[],
  orderByField: string,
  direction: 'asc' | 'desc',
) {
  const multiplier = direction === 'desc' ? -1 : 1;
  return [...items].sort((left, right) => {
    const primary = compareReadModelValues(left?.[orderByField], right?.[orderByField]);
    if (primary !== 0) return primary * multiplier;
    return compareReadModelValues(left?.id, right?.id) * multiplier;
  });
}

function applyReadModelCursor(items: Record<string, any>[], cursor?: DiscoveryListCursor | null) {
  if (!cursor?.id) return items;
  const cursorIndex = items.findIndex((item) => item?.id === cursor.id);
  return cursorIndex >= 0 ? items.slice(cursorIndex + 1) : items;
}

function encodeDiscoveryCursor(cursor?: DiscoveryListCursor | null) {
  if (!cursor?.id) return null;
  return JSON.stringify(cursor);
}

function decodeDiscoveryCursor(rawCursor: any): DiscoveryListCursor | null {
  if (!rawCursor) return null;
  try {
    const parsed = JSON.parse(String(rawCursor));
    if (parsed?.mode === 'list' && typeof parsed?.id === 'string') {
      return {
        mode: 'list',
        value: parsed?.value ?? null,
        id: parsed.id,
      };
    }
  } catch (error: any) {
    console.warn(
      '[PublicDiscoveryService] decodeDiscoveryCursor failed to parse cursor:',
      error.message,
    );
  }
  return null;
}

function buildDiscoveryListCursor(
  item: Record<string, any>,
  orderByField: string,
): DiscoveryListCursor | null {
  const id = String(item?.id || '');
  if (!id) return null;
  return {
    mode: 'list',
    value: item?.[orderByField] ?? null,
    id,
  };
}

function buildHostAppliedFilters(query: ListParams = {}) {
  const cityKey = normalizeCityKey(query.cityKey || query.city);
  const search = String(query.search || query.q || '')
    .trim()
    .toLowerCase();
  return {
    cityKey: cityKey || null,
    role: query.role || null,
    vibe: query.vibe || null,
    verified: query.verified ?? null,
    trending: query.trending ?? null,
    status: query.status || null,
    search: search || null,
    sort: normalizeDiscoverySort(query.sort),
  };
}

function buildVenueAppliedFilters(query: ListParams = {}) {
  const cityKey = normalizeCityKey(query.cityKey || query.city);
  const search = String(query.search || query.q || '')
    .trim()
    .toLowerCase();
  const areaKey = query.areaKey || (query.area ? normalizeFilterKey(query.area) : null);
  return {
    cityKey: cityKey || null,
    areaKey: areaKey || null,
    tablesAvailable: query.tablesAvailable ?? query.tablesOnly ?? null,
    verified: query.verified ?? null,
    vibe: query.vibe || null,
    search: search || null,
    sort: normalizeDiscoverySort(query.sort),
  };
}

function matchesHostDiscoveryFilters(item: Record<string, any>, query: ListParams = {}) {
  if (!item || item.visibility !== 'public') return false;
  const cityKey = normalizeCityKey(query.cityKey || query.city);
  const search = String(query.search || query.q || '')
    .trim()
    .toLowerCase();
  const status = String(query.status || '')
    .trim()
    .toLowerCase();
  if (cityKey && item.cityKey !== cityKey) return false;
  if (query.role && String(item.role || '').toLowerCase() !== String(query.role).toLowerCase())
    return false;
  if (query.vibe) {
    const vibe = String(query.vibe).toLowerCase();
    const hasVibe =
      Array.isArray(item.vibes) && item.vibes.some((value) => String(value).toLowerCase() === vibe);
    if (!hasVibe) return false;
  }
  if (
    search &&
    !String(item.searchText || '')
      .toLowerCase()
      .includes(search)
  )
    return false;
  if ((normalizeBoolean(query.verified) || status === 'verified') && !item.verified) return false;
  if ((normalizeBoolean(query.trending) || status === 'trending') && !item.trending) return false;
  if (
    status === 'popular' &&
    !(item.popular || Number(item.followersCount || item.followers || 0) > 0)
  )
    return false;
  return true;
}

function matchesVenueDiscoveryFilters(item: Record<string, any>, query: ListParams = {}) {
  if (!item || item.visibility !== 'public') return false;
  const cityKey = normalizeCityKey(query.cityKey || query.city);
  const areaKey = query.areaKey || (query.area ? normalizeFilterKey(query.area) : null);
  const search = String(query.search || query.q || '')
    .trim()
    .toLowerCase();
  if (cityKey && item.cityKey !== cityKey) return false;
  if (areaKey && item.areaKey !== areaKey) return false;
  if (query.vibe) {
    const vibe = String(query.vibe).toLowerCase();
    const hasVibe = [item.tags, item.vibes, item.genres].some(
      (values) =>
        Array.isArray(values) && values.some((value) => String(value).toLowerCase() === vibe),
    );
    if (!hasVibe) return false;
  }
  if (
    search &&
    !String(item.searchText || '')
      .toLowerCase()
      .includes(search)
  )
    return false;
  if (
    (normalizeBoolean(query.tablesAvailable) || normalizeBoolean(query.tablesOnly)) &&
    !item.tablesAvailable
  )
    return false;
  if (normalizeBoolean(query.verified) && !item.verified) return false;
  return true;
}

async function processInBatches<T>(
  items: T[],
  batchSize: number,
  handler: (item: T) => Promise<void>,
) {
  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    await Promise.all(batch.map((item) => handler(item)));
  }
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
    const slugSnap = await this.db
      .collection(EVENT_CARD_INDEX)
      .where('slug', '==', idOrSlug)
      .limit(1)
      .get();
    if (!slugSnap.empty) return serializeDoc(slugSnap.docs[0]);
    return null;
  }

  async upsert(id: string, data: Record<string, any>) {
    await this.db.collection(EVENT_CARD_INDEX).doc(id).set(data, { merge: true });
  }

  async delete(id: string) {
    try {
      await this.db.collection(EVENT_CARD_INDEX).doc(id).delete();
    } catch (error: any) {
      console.error(`[EventCardRepository] delete failed for ${id}:`, error);
      throw error;
    }
  }

  async queryList({
    limit = 48,
    orderByField = 'startAt',
    direction = 'asc',
    cityKey,
    areaKey,
    hostId,
    venueId,
    minEndAt,
  }: {
    limit?: number;
    orderByField?: string;
    direction?: 'asc' | 'desc';
    cityKey?: string | null;
    areaKey?: string | null;
    hostId?: string | null;
    venueId?: string | null;
    minEndAt?: string | null;
  }) {
    try {
      let query: any = this.db.collection(EVENT_CARD_INDEX).where('visibility', '==', 'public');
      if (cityKey) query = query.where('cityKey', '==', cityKey);
      if (areaKey) query = query.where('areaKey', '==', areaKey);
      if (hostId) query = query.where('hostId', '==', hostId);
      if (venueId) query = query.where('venueId', '==', venueId);
      // Bound the Firestore-side fetch to non-past events when sorting
      // soonest-first, so a growing backlog of past events (ordinary once
      // the platform has been live a while) can't crowd every upcoming
      // event out of the `limit` window before the in-memory
      // isCurrentOrUpcomingGuestEvent filter ever runs.
      if (minEndAt && orderByField === 'startAt' && direction === 'asc') {
        query = query.where('startAt', '>=', minEndAt);
      }
      const snapshot = await query.orderBy(orderByField, direction).limit(limit).get();
      return snapshot.docs.map(serializeDoc);
    } catch (error: any) {
      console.error(`[PublicDiscoveryService] queryList failed for ${EVENT_CARD_INDEX}`, error);
      throw error;
    }
  }

  async querySearchPrefix(needle: string, limit = 24) {
    const normalized = String(needle || '')
      .trim()
      .toLowerCase();
    if (!normalized) return [];
    try {
      const snapshot = await this.db
        .collection(EVENT_CARD_INDEX)
        .where('visibility', '==', 'public')
        .orderBy('searchText')
        .startAt(normalized)
        .endAt(`${normalized}\uf8ff`)
        .limit(limit)
        .get();
      return snapshot.docs.map(serializeDoc);
    } catch (error: any) {
      console.error(
        `[PublicDiscoveryService] querySearchPrefix failed for ${EVENT_CARD_INDEX}`,
        error,
      );
      throw error;
    }
  }
}

class HostSummaryRepository {
  constructor(private db: Firestore) {}

  async listAll() {
    const snapshot = await this.db.collection(HOST_SUMMARY).get();
    return snapshot.docs.map(serializeDoc);
  }

  async get(id: string) {
    const doc = await this.db.collection(HOST_SUMMARY).doc(id).get();
    return doc.exists ? serializeDoc(doc) : null;
  }

  async getBySlug(slug: string) {
    const direct = await this.db.collection(HOST_SUMMARY).doc(slug).get();
    if (direct.exists) return serializeDoc(direct);
    const slugSnap = await this.db
      .collection(HOST_SUMMARY)
      .where('slug', '==', slug)
      .limit(1)
      .get();
    if (!slugSnap.empty) return serializeDoc(slugSnap.docs[0]);
    return null;
  }

  async upsert(id: string, data: Record<string, any>) {
    await this.db.collection(HOST_SUMMARY).doc(id).set(data, { merge: true });
  }

  async queryList({
    limit = 48,
    orderByField = 'followersCount',
    direction = 'desc',
    cityKey,
    role,
    cursor,
  }: {
    limit?: number;
    orderByField?: string;
    direction?: 'asc' | 'desc';
    cityKey?: string | null;
    role?: string | null;
    cursor?: DiscoveryListCursor | null;
  }) {
    try {
      let query: any = this.db.collection(HOST_SUMMARY).where('visibility', '==', 'public');
      if (cityKey) query = query.where('cityKey', '==', cityKey);
      if (role) query = query.where('role', '==', role);
      if (orderByField === 'id') {
        query = query.orderBy(FieldPath.documentId(), direction);
        if (cursor?.id) query = query.startAfter(cursor.id);
      } else {
        query = query.orderBy(orderByField, direction).orderBy(FieldPath.documentId(), direction);
        if (cursor?.id) query = query.startAfter(cursor.value ?? null, cursor.id);
      }
      const snapshot = await query.limit(limit).get();
      return snapshot.docs.map(serializeDoc);
    } catch (error: any) {
      console.error(`[PublicDiscoveryService] queryList failed for ${HOST_SUMMARY}`, error);
      throw error;
    }
  }

  async querySearchPrefix(needle: string, limit = 24) {
    const normalized = String(needle || '')
      .trim()
      .toLowerCase();
    if (!normalized) return [];
    try {
      const snapshot = await this.db
        .collection(HOST_SUMMARY)
        .where('visibility', '==', 'public')
        .orderBy('searchText')
        .startAt(normalized)
        .endAt(`${normalized}\uf8ff`)
        .limit(limit)
        .get();
      return snapshot.docs.map(serializeDoc);
    } catch (error: any) {
      console.error(`[PublicDiscoveryService] querySearchPrefix failed for ${HOST_SUMMARY}`, error);
      throw error;
    }
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
    const slugSnap = await this.db
      .collection(VENUE_SUMMARY)
      .where('slug', '==', slug)
      .limit(1)
      .get();
    if (!slugSnap.empty) return serializeDoc(slugSnap.docs[0]);
    return null;
  }

  async upsert(id: string, data: Record<string, any>) {
    await this.db.collection(VENUE_SUMMARY).doc(id).set(data, { merge: true });
  }

  async queryList({
    limit = 48,
    orderByField = 'followersCount',
    direction = 'desc',
    cityKey,
    areaKey,
    tablesAvailable,
    cursor,
  }: {
    limit?: number;
    orderByField?: string;
    direction?: 'asc' | 'desc';
    cityKey?: string | null;
    areaKey?: string | null;
    tablesAvailable?: boolean | null;
    cursor?: DiscoveryListCursor | null;
  }) {
    try {
      let query: any = this.db.collection(VENUE_SUMMARY).where('visibility', '==', 'public');
      if (cityKey) query = query.where('cityKey', '==', cityKey);
      if (areaKey) query = query.where('areaKey', '==', areaKey);
      if (tablesAvailable === true) query = query.where('tablesAvailable', '==', true);
      if (orderByField === 'id') {
        query = query.orderBy(FieldPath.documentId(), direction);
        if (cursor?.id) query = query.startAfter(cursor.id);
      } else {
        query = query.orderBy(orderByField, direction).orderBy(FieldPath.documentId(), direction);
        if (cursor?.id) query = query.startAfter(cursor.value ?? null, cursor.id);
      }
      const snapshot = await query.limit(limit).get();
      return snapshot.docs.map(serializeDoc);
    } catch (error: any) {
      console.error(`[PublicDiscoveryService] queryList failed for ${VENUE_SUMMARY}`, error);
      throw error;
    }
  }

  async querySearchPrefix(needle: string, limit = 24) {
    const normalized = String(needle || '')
      .trim()
      .toLowerCase();
    if (!normalized) return [];
    try {
      const snapshot = await this.db
        .collection(VENUE_SUMMARY)
        .where('visibility', '==', 'public')
        .orderBy('searchText')
        .startAt(normalized)
        .endAt(`${normalized}\uf8ff`)
        .limit(limit)
        .get();
      return snapshot.docs.map(serializeDoc);
    } catch (error: any) {
      console.error(
        `[PublicDiscoveryService] querySearchPrefix failed for ${VENUE_SUMMARY}`,
        error,
      );
      throw error;
    }
  }
}

export class PublicDiscoveryService {
  private events: EventCardIndexRepository;
  private hosts: HostSummaryRepository;
  private venues: VenueSummaryRepository;
  private eventCardsChecked = false;
  private hostSummaryChecked = false;
  private venueSummaryChecked = false;
  private bootstrapPromise: Promise<void> | null = null;

  constructor(private db: Firestore) {
    this.events = new EventCardIndexRepository(db);
    this.hosts = new HostSummaryRepository(db);
    this.venues = new VenueSummaryRepository(db);
  }

  private resolveEventQueryShape(query: ListParams = {}) {
    const normalizedSort = query.sort ? String(query.sort).trim().toLowerCase() : '';
    const cityKey = normalizeCityKey(query.cityKey || query.city || null);
    return {
      cityKey,
      areaKey: normalizeFilterKey(query.areaKey || query.area || null),
      hostId: query.hostId ? String(query.hostId) : null,
      venueId: query.venueId ? String(query.venueId) : null,
      orderByField:
        normalizedSort === 'heat' ||
        normalizedSort === 'heatscore' ||
        normalizedSort === 'trending' ||
        normalizedSort === 'popular'
          ? 'heatScore'
          : normalizedSort === 'new' ||
              normalizedSort === 'newest' ||
              normalizedSort === 'publishedat' ||
              normalizedSort === 'createdat'
            ? 'publishedAt'
            : normalizedSort === 'price' ||
                normalizedSort === 'price low to high' ||
                normalizedSort === 'pricemin'
              ? 'priceMin'
              : 'startAt',
      direction:
        normalizedSort === 'heat' ||
        normalizedSort === 'heatscore' ||
        normalizedSort === 'trending' ||
        normalizedSort === 'popular' ||
        normalizedSort === 'new' ||
        normalizedSort === 'newest' ||
        normalizedSort === 'publishedat' ||
        normalizedSort === 'createdat'
          ? 'desc'
          : ('asc' as 'asc' | 'desc'),
    };
  }

  private async resolveHostId(query: ListParams = {}) {
    if (query.hostId) return String(query.hostId);
    const slug = query.hostSlug || query.host || null;
    if (!slug) return null;
    try {
      const host = await this.hosts.getBySlug(String(slug));
      return host?.id || null;
    } catch (error: any) {
      console.error(`[PublicDiscoveryService] resolveHostId failed for slug ${slug}:`, error);
      throw error;
    }
  }

  private async resolveVenueId(query: ListParams = {}) {
    if (query.venueId) return String(query.venueId);
    const slug = query.venueSlug || query.venue || null;
    if (!slug) return null;
    try {
      const venue = await this.venues.getBySlug(String(slug));
      return venue?.id || null;
    } catch (error: any) {
      console.error(`[PublicDiscoveryService] resolveVenueId failed for slug ${slug}:`, error);
      throw error;
    }
  }

  async bootstrapReadModels(log: BootstrapLogger = console) {
    if (this.eventCardsChecked && this.hostSummaryChecked && this.venueSummaryChecked) return;
    if (this.bootstrapPromise) return this.bootstrapPromise;

    this.bootstrapPromise = this.runBootstrap(log).finally(() => {
      this.bootstrapPromise = null;
    });

    return this.bootstrapPromise;
  }

  async ensureSeeded(log: BootstrapLogger = console) {
    await this.bootstrapReadModels(log);
  }

  private async runBootstrap(log: BootstrapLogger) {
    log.info('[PublicDiscoveryService] Bootstrapping public discovery read models...');

    const state = await this.getBootstrapState();
    if (this.isBootstrapStateCurrent(state)) {
      this.markBootstrapComplete();
      log.info('[PublicDiscoveryService] Public discovery read models already current.');
      return;
    }

    await this.ensureEventCardsSeeded(state);

    const shouldSeedProfiles = !this.hostSummaryChecked || !this.venueSummaryChecked;
    const eventCards = shouldSeedProfiles ? await this.events.listAll() : [];

    await Promise.all([
      this.ensureHostSummarySeeded(state, eventCards),
      this.ensureVenueSummarySeeded(state, eventCards),
    ]);

    await this.writeBootstrapState();
    log.info('[PublicDiscoveryService] Public discovery read models ready.');
  }

  private async getBootstrapState(): Promise<BootstrapState | null> {
    try {
      const doc = await this.db.collection(SYSTEM_META).doc(PUBLIC_DISCOVERY_BOOTSTRAP_DOC).get();
      if (!doc?.exists) return null;
      return doc.data() as BootstrapState;
    } catch (error: any) {
      console.error('[PublicDiscoveryService] getBootstrapState failed:', error);
      throw error;
    }
  }

  private isBootstrapStateCurrent(state: BootstrapState | null) {
    if (!state) return false;
    return (
      state.eventCardIndexVersion === EVENT_CARD_INDEX_VERSION &&
      state.hostSummaryVersion === HOST_SUMMARY_VERSION &&
      state.venueSummaryVersion === VENUE_SUMMARY_VERSION
    );
  }

  private markBootstrapComplete() {
    this.eventCardsChecked = true;
    this.hostSummaryChecked = true;
    this.venueSummaryChecked = true;
  }

  private async writeBootstrapState() {
    this.markBootstrapComplete();
    await this.db.collection(SYSTEM_META).doc(PUBLIC_DISCOVERY_BOOTSTRAP_DOC).set(
      {
        eventCardIndexVersion: EVENT_CARD_INDEX_VERSION,
        hostSummaryVersion: HOST_SUMMARY_VERSION,
        venueSummaryVersion: VENUE_SUMMARY_VERSION,
        completedAt: new Date().toISOString(),
      },
      { merge: true },
    );
  }

  private async forEachCollectionDoc(collectionName: string, handler: (doc: any) => Promise<void>) {
    let cursor: any = null;

    while (true) {
      let query: any = this.db
        .collection(collectionName)
        .orderBy(FieldPath.documentId())
        .limit(EVENT_CARD_BACKFILL_BATCH_SIZE);

      if (cursor) {
        query = query.startAfter(cursor);
      }

      const snapshot = await query.get();
      if (snapshot.empty) return;

      await processInBatches(snapshot.docs, 10, handler);

      if (snapshot.docs.length < EVENT_CARD_BACKFILL_BATCH_SIZE) return;
      cursor = snapshot.docs[snapshot.docs.length - 1];
    }
  }

  private async ensureEventCardsSeeded(state?: BootstrapState | null) {
    if (this.eventCardsChecked) return;
    if (state?.eventCardIndexVersion === EVENT_CARD_INDEX_VERSION) {
      this.eventCardsChecked = true;
      return;
    }

    const existingCards = await this.events.listAll();
    const needsBackfill =
      existingCards.length === 0 ||
      existingCards.some(
        (card) =>
          card.readModelVersion !== EVENT_CARD_INDEX_VERSION ||
          !card.startDate ||
          !card.category ||
          !card.startDateTime,
      );

    if (!needsBackfill) {
      this.eventCardsChecked = true;
      return;
    }

    await this.forEachCollectionDoc('events', async (doc) => {
      await this.syncEventReadModelsFromSnapshot(doc);
    });
    this.eventCardsChecked = true;
  }

  private async ensureHostSummarySeeded(
    state?: BootstrapState | null,
    eventCards?: Record<string, any>[],
  ) {
    if (this.hostSummaryChecked) return;
    if (state?.hostSummaryVersion === HOST_SUMMARY_VERSION) {
      this.hostSummaryChecked = true;
      return;
    }

    const snapshot = await this.db.collection(HOST_SUMMARY).limit(1).get();
    const needsBackfill =
      snapshot.empty ||
      snapshot.docs.some((doc) => doc.data()?.readModelVersion !== HOST_SUMMARY_VERSION);
    if (!needsBackfill) {
      this.hostSummaryChecked = true;
      return;
    }

    const cards = eventCards?.length ? eventCards : await this.events.listAll();
    await this.forEachCollectionDoc('hosts', async (doc) => {
      await this.syncHostReadModelsFromSnapshot(doc, cards);
    });
    this.hostSummaryChecked = true;
  }

  private async ensureVenueSummarySeeded(
    state?: BootstrapState | null,
    eventCards?: Record<string, any>[],
  ) {
    if (this.venueSummaryChecked) return;
    if (state?.venueSummaryVersion === VENUE_SUMMARY_VERSION) {
      this.venueSummaryChecked = true;
      return;
    }

    const snapshot = await this.db.collection(VENUE_SUMMARY).limit(1).get();
    const needsBackfill =
      snapshot.empty ||
      snapshot.docs.some((doc) => doc.data()?.readModelVersion !== VENUE_SUMMARY_VERSION);
    if (!needsBackfill) {
      this.venueSummaryChecked = true;
      return;
    }

    const cards = eventCards?.length ? eventCards : await this.events.listAll();
    await this.forEachCollectionDoc('venues', async (doc) => {
      await this.syncVenueReadModelsFromSnapshot(doc, cards);
    });
    this.venueSummaryChecked = true;
  }

  async syncEventReadModels(eventId: string) {
    const doc = await this.db.collection('events').doc(eventId).get();
    await this.syncEventReadModelsFromSnapshot(doc);
  }

  private async syncEventReadModelsFromSnapshot(doc: any) {
    if (!doc.exists) {
      await this.events.delete(doc.id);
      return;
    }
    const serialized = serializeDoc(doc);
    const rawEvent = mapEventForClient(doc.data(), doc.id) || serialized;
    const event = { ...serialized, ...rawEvent };
    if (!isGuestEventPublic(event)) {
      await this.events.delete(doc.id);
      return;
    }
    const card = buildEventCardReadModel(event, { readModelVersion: EVENT_CARD_INDEX_VERSION });
    await this.events.upsert(event.id, card);
    // ⚡ Performance: Invalidate the public discovery cache for events
    await bumpCacheVersion('events').catch((error: any) => {
      console.error('[PublicDiscoveryService] bumpCacheVersion failed for events:', error);
    });
    await bumpCacheVersion('search').catch((error: any) => {
      console.error('[PublicDiscoveryService] bumpCacheVersion failed for search:', error);
    });
  }

  async syncHostReadModels(hostId: string) {
    const doc = await this.db.collection('hosts').doc(hostId).get();
    await this.syncHostReadModelsFromSnapshot(doc);
  }

  private async syncHostReadModelsFromSnapshot(
    doc: any,
    eventCardsOverride?: Record<string, any>[],
  ) {
    if (!doc.exists) return;
    const host = serializeDoc(doc);
    const eventCards = (eventCardsOverride || (await this.events.listAll())).filter(
      (event) => event.hostId === host.id && event.visibility === 'public',
    );
    // Load existing popularity statistics to prevent rebuild overwrites
    let existingSummary = null;
    try {
      existingSummary = await this.hosts.get(host.id);
    } catch (error: any) {
      console.error(
        `[PublicDiscoveryService] syncHostReadModelsFromSnapshot: failed to get host ${host.id}:`,
        error,
      );
      throw error;
    }
    const summary = buildHostSummaryReadModel(
      {
        ...host,
        clickCount: existingSummary?.clickCount || 0,
        recentClickCount: existingSummary?.recentClickCount || 0,
        ticketSalesCount: existingSummary?.ticketSalesCount || 0,
        lastVisitedAt: existingSummary?.lastVisitedAt || null,
      },
      eventCards,
      {
        readModelVersion: HOST_SUMMARY_VERSION,
      },
    );
    await this.hosts.upsert(host.id, summary);
    // ⚡ Performance: Invalidate the public discovery cache for hosts
    await bumpCacheVersion('hosts').catch((error: any) => {
      console.error('[PublicDiscoveryService] bumpCacheVersion failed for hosts:', error);
    });
    await bumpCacheVersion('search').catch((error: any) => {
      console.error('[PublicDiscoveryService] bumpCacheVersion failed for search:', error);
    });
  }

  async syncVenueReadModels(venueId: string) {
    const doc = await this.db.collection('venues').doc(venueId).get();
    await this.syncVenueReadModelsFromSnapshot(doc);
  }

  private async syncVenueReadModelsFromSnapshot(
    doc: any,
    eventCardsOverride?: Record<string, any>[],
  ) {
    if (!doc.exists) return;
    const venue = serializeDoc(doc);
    const eventCards = (eventCardsOverride || (await this.events.listAll())).filter(
      (event) => event.venueId === venue.id && event.visibility === 'public',
    );
    let menuSnapshot;
    let highlightsSnapshot;
    let existingSummaryDoc;
    try {
      [menuSnapshot, highlightsSnapshot, existingSummaryDoc] = await Promise.all([
        this.db.collection(VENUE_MENU).where('venueId', '==', venue.id).limit(1).get(),
        this.db
          .collection(PROFILE_HIGHLIGHTS)
          .where('profileId', '==', venue.id)
          .where('profileType', '==', 'venue')
          .get(),
        this.db.collection(VENUE_SUMMARY).doc(venue.id).get(),
      ]);
    } catch (error: any) {
      console.error(
        `[PublicDiscoveryService] syncVenueReadModelsFromSnapshot: failed to fetch venue ${venue.id} summaries:`,
        error,
      );
      throw error;
    }
    const existingData = existingSummaryDoc?.exists ? existingSummaryDoc.data() : {};

    const venueWithStats = {
      ...venue,
      clickCount: existingData?.clickCount ?? 0,
      ticketSalesCount: existingData?.ticketSalesCount ?? 0,
      recentClickCount: existingData?.recentClickCount ?? 0,
      lastVisitedAt: existingData?.lastVisitedAt ?? null,
      followersCount: venue.followersCount ?? existingData?.followersCount ?? 0,
    };

    const summary = buildVenueSummaryReadModel(venueWithStats, eventCards, {
      readModelVersion: VENUE_SUMMARY_VERSION,
      menuAvailable: Boolean(menuSnapshot && !menuSnapshot.empty),
      highlightsCount: highlightsSnapshot?.size || 0,
    });
    await this.venues.upsert(venue.id, summary);
    // ⚡ Performance: Invalidate the public discovery cache for venues
    await bumpCacheVersion('venues').catch((error: any) => {
      console.error('[PublicDiscoveryService] bumpCacheVersion failed for venues:', error);
    });
    await bumpCacheVersion('search').catch((error: any) => {
      console.error('[PublicDiscoveryService] bumpCacheVersion failed for search:', error);
    });
  }

  async listEvents(query: ListParams) {
    try {
      const limit = Math.min(Math.max(Number(query.limit) || 12, 1), 24);
      const searchNeedle = String(query.search || query.q || '')
        .trim()
        .toLowerCase();
      const hostId = await this.resolveHostId(query);
      const venueId = await this.resolveVenueId(query);
      const normalizedQuery = {
        ...query,
        cityKey: normalizeCityKey(query.cityKey || query.city || null),
        hostId: hostId || query.hostId || null,
        venueId: venueId || query.venueId || null,
      };

      const eventQueryShape = this.resolveEventQueryShape({ ...query, hostId, venueId });
      // Firestore can only combine a `startAt` range filter with `orderBy('startAt')` —
      // it can't be pushed alongside an orderBy on a different field (e.g. heatScore).
      // For those sorts, over-fetch a much larger pool so enough upcoming events survive
      // the isCurrentOrUpcomingGuestEvent filter below instead of being crowded out by a
      // backlog of higher-ranked past events before the requested `limit` is ever applied.
      const canFilterUpcomingInFirestore =
        eventQueryShape.orderByField === 'startAt' && eventQueryShape.direction === 'asc';
      const fetchLimit = canFilterUpcomingInFirestore
        ? Math.min(Math.max(limit * 2, 24), 48)
        : Math.min(Math.max(limit * 8, 96), 200);

      const items = searchNeedle
        ? await this.events.querySearchPrefix(searchNeedle, Math.min(Math.max(limit * 2, 18), 48))
        : await this.events.queryList({
            ...eventQueryShape,
            hostId,
            venueId,
            limit: fetchLimit,
            minEndAt: new Date().toISOString().slice(0, 10),
          });
      const normalizedItems = items.map((item: any) =>
        buildEventCardReadModel(item, {
          readModelVersion: item?.readModelVersion || EVENT_CARD_INDEX_VERSION,
        }),
      );
      return filterGuestEventCards(normalizedItems, normalizedQuery);
    } catch (error: any) {
      if (
        String(error?.message || '')
          .toLowerCase()
          .includes('index')
      ) {
        console.error(
          '[PublicDiscoveryService] listEvents: missing Firestore index — run index deployment',
          { query, error: error.message },
        );
      } else {
        console.error('[PublicDiscoveryService] listEvents failed', error);
      }
      throw error;
    }
  }

  async listFeaturedEvents(query: ListParams = {}) {
    try {
      const limit = Math.min(Math.max(Number(query.limit) || 6, 1), 12);
      const hostId = await this.resolveHostId(query);
      const venueId = await this.resolveVenueId(query);
      const normalizedQuery = {
        ...query,
        cityKey: normalizeCityKey(query.cityKey || query.city || null),
        hostId: hostId || query.hostId || null,
        venueId: venueId || query.venueId || null,
      };
      let settings;
      try {
        settings = await this.db.collection('platform_settings').doc('spotlights').get();
      } catch (error: any) {
        console.error(
          '[PublicDiscoveryService] listFeaturedEvents: failed to fetch platform spotlights:',
          error,
        );
        throw error;
      }
      const pinnedIds = Array.isArray(settings?.data?.()?.featured)
        ? settings.data()!.featured.filter((id: any) => typeof id === 'string' && id.trim())
        : [];
      const pinned = (
        await Promise.all(pinnedIds.map((id: string) => this.events.getByIdOrSlug(id)))
      )
        .filter(Boolean)
        .map((event: any) =>
          buildEventCardReadModel(event, {
            readModelVersion: event?.readModelVersion || EVENT_CARD_INDEX_VERSION,
          }),
        )
        .filter(
          (event: any) => event.visibility === 'public' && isCurrentOrUpcomingGuestEvent(event),
        );
      const heatItems = await this.events.queryList({
        ...this.resolveEventQueryShape({ ...query, hostId, venueId, sort: 'heat' }),
        hostId,
        venueId,
        // heatScore ordering can't carry a startAt range filter in Firestore, so
        // over-fetch (see listEvents) rather than risk a backlog of higher-heat
        // past events crowding every upcoming one out of a tight limit.
        limit: Math.min(Math.max(limit * 8, 96), 200),
        orderByField: 'heatScore',
        direction: 'desc',
      });
      const heat = heatItems
        .map((event: any) =>
          buildEventCardReadModel(event, {
            readModelVersion: event?.readModelVersion || EVENT_CARD_INDEX_VERSION,
          }),
        )
        .filter((event: any) => isCurrentOrUpcomingGuestEvent(event));
      const seen = new Set();
      const items = filterGuestEventCards([...pinned, ...heat], normalizedQuery)
        .items.filter((event: any) => {
          if (!event?.id || seen.has(event.id)) return false;
          seen.add(event.id);
          return true;
        })
        .slice(0, limit);
      return {
        items,
        nextCursor: null,
        hasMore: false,
        appliedFilters: { sort: 'heatScore' },
      };
    } catch (error: any) {
      if (
        String(error?.message || '')
          .toLowerCase()
          .includes('index')
      ) {
        console.error(
          '[PublicDiscoveryService] listFeaturedEvents: missing Firestore index — run index deployment',
          { query, error: error.message },
        );
      } else {
        console.error('[PublicDiscoveryService] listFeaturedEvents failed', error);
      }
      throw error;
    }
  }

  async getEventDetail(idOrSlug: string) {
    try {
      const indexed = await this.events.getByIdOrSlug(idOrSlug);
      let raw = indexed?.id ? await this.db.collection('events').doc(indexed.id).get() : null;

      if (!raw?.exists) {
        const direct = await this.db.collection('events').doc(idOrSlug).get();
        if (direct?.exists) raw = direct;
      }

      if (!raw?.exists) {
        const slugSnap = await this.db
          .collection('events')
          .where('slug', '==', idOrSlug)
          .limit(1)
          .get();
        if (slugSnap && !slugSnap.empty) raw = slugSnap.docs[0];
      }

      if (!indexed && !raw?.exists) return null;

      const details = raw?.exists ? mapEventForClient(serializeDoc(raw), raw.id) : {};
      const eventSource = {
        ...(indexed || {}),
        ...(details || {}),
        id: details?.id || indexed?.id,
      };
      if (!eventSource.id || !isGuestEventPublic(eventSource)) return null;

      const normalizedCard = buildEventCardReadModel(eventSource, {
        readModelVersion: indexed?.readModelVersion || EVENT_CARD_INDEX_VERSION,
      });
      const normalizedLifecycle = derivePublicLifecycleForDetail(
        eventSource,
        normalizedCard.statusKey,
      );
      const event = {
        ...(details || {}),
        ...(indexed || {}),
        ...normalizedCard,
        id: normalizedCard.id,
        lifecycle: normalizedLifecycle,
        status: normalizedLifecycle,
        statusKey: normalizedCard.statusKey,
      };
      if (!event.id || !isGuestEventDetailVisible(event)) return null;

      const interestedData = await getEventInterested(this.db, event.id, 20).catch((error) => {
        console.error(
          `[PublicDiscoveryService] getEventDetail: failed to load interested data for event ${event.id}:`,
          error,
        );
        return {
          count: Number(event.stats?.saves || 0),
          users: [],
        };
      });

      return { event, interestedData };
    } catch (error: any) {
      console.error(`[PublicDiscoveryService] getEventDetail failed for ${idOrSlug}:`, error);
      throw error;
    }
  }

  async listHosts(query: ListParams) {
    try {
      const limit = normalizeGuestDiscoveryLimit(query.limit, 12, 24);
      const orderByField = normalizeDiscoverySort(query.sort);
      const direction = orderByField === 'nextEventAt' ? 'asc' : 'desc';
      const chunkSize = Math.max(limit * 4, 48);
      const requestCursor = decodeDiscoveryCursor(query.cursor || query.lastId);
      let cursor = requestCursor;
      let exhausted = false;
      const items: Record<string, any>[] = [];
      let nextCursor = requestCursor;

      while (!exhausted) {
        const chunk = await this.hosts.queryList({
          cityKey: normalizeCityKey(query.cityKey || query.city || null),
          role: query.role ? String(query.role) : null,
          orderByField,
          direction,
          limit: chunkSize,
          cursor,
        });

        if (!chunk.length) {
          exhausted = true;
          break;
        }

        for (const item of chunk) {
          const itemCursor = buildDiscoveryListCursor(item, orderByField);
          if (matchesHostDiscoveryFilters(item, query)) {
            if (items.length < limit) {
              items.push(item);
              nextCursor = itemCursor;
            } else {
              return buildGuestDiscoveryEnvelope(items, {
                nextCursor: encodeDiscoveryCursor(nextCursor),
                hasMore: true,
                appliedFilters: buildHostAppliedFilters(query),
              });
            }
          }
          cursor = itemCursor;
        }

        if (chunk.length < chunkSize) {
          exhausted = true;
        }
      }

      return buildGuestDiscoveryEnvelope(items, {
        nextCursor: null,
        hasMore: false,
        appliedFilters: buildHostAppliedFilters(query),
      });
    } catch (error: any) {
      console.error('[PublicDiscoveryService] listHosts failed', error);
      throw error;
    }
  }

  async getHostPublicProfile(slug: string) {
    const host = await this.hosts.getBySlug(slug);
    if (!host) return null;
    const [rawDoc, postsSnap, highlightsSnap, statsSnap, allEvents] = await Promise.all([
      this.db
        .collection('hosts')
        .doc(host.id)
        .get()
        .catch(() => null),
      this.db
        .collection(PROFILE_POSTS)
        .where('profileId', '==', host.id)
        .where('profileType', '==', 'host')
        .limit(12)
        .get()
        .catch(() => null),
      this.db
        .collection(PROFILE_HIGHLIGHTS)
        .where('profileId', '==', host.id)
        .where('profileType', '==', 'host')
        .get()
        .catch(() => null),
      this.db
        .collection(PROFILE_STATS)
        .doc(`host_${host.id}`)
        .get()
        .catch(() => null),
      this.events.queryList({
        hostId: host.id,
        limit: 48,
        orderByField: 'startAt',
        direction: 'asc',
        minEndAt: new Date().toISOString().slice(0, 10),
      }),
    ]);
    const hostEvents = allEvents
      .filter((event: any) => event.hostId === host.id)
      .sort((a: any, b: any) => String(a.startAt || '').localeCompare(String(b.startAt || '')));
    const rawHost = rawDoc?.exists ? serializeDoc(rawDoc) : {};
    if (!isGuestPublicProfileEnabled({ ...rawHost, ...host })) return null;
    return {
      host: projectGuestHostDetail(rawHost, host),
      stats: statsSnap?.exists
        ? serializeDoc(statsSnap)
        : { followersCount: host.followersCount, upcomingEventsCount: host.upcomingEventsCount },
      posts: postsSnap?.docs?.map(serializeDoc) || [],
      highlights: highlightsSnap?.docs?.map(serializeDoc) || [],
      upcomingEvents: hostEvents.filter((event: any) => event.statusKey === 'upcoming').slice(0, 6),
      pastEvents: hostEvents.filter((event: any) => event.statusKey === 'ended').slice(0, 6),
    };
  }

  async listVenues(query: ListParams) {
    try {
      const limit = normalizeGuestDiscoveryLimit(query.limit, 12, 24);
      const orderByField = normalizeDiscoverySort(query.sort);
      const direction = orderByField === 'nextEventAt' ? 'asc' : 'desc';
      const chunkSize = Math.max(limit * 4, 48);
      const requestCursor = decodeDiscoveryCursor(query.cursor || query.lastId);
      let cursor = requestCursor;
      let exhausted = false;
      const items: Record<string, any>[] = [];
      let nextCursor = requestCursor;

      while (!exhausted) {
        const chunk = await this.venues.queryList({
          cityKey: normalizeCityKey(query.cityKey || query.city || null),
          areaKey: normalizeFilterKey(query.areaKey || query.area || null),
          tablesAvailable:
            String(query.tablesOnly || query.tablesAvailable || '').toLowerCase() === 'true'
              ? true
              : null,
          orderByField,
          direction,
          limit: chunkSize,
          cursor,
        });

        if (!chunk.length) {
          exhausted = true;
          break;
        }

        for (const item of chunk) {
          const itemCursor = buildDiscoveryListCursor(item, orderByField);
          if (matchesVenueDiscoveryFilters(item, query)) {
            if (items.length < limit) {
              items.push(item);
              nextCursor = itemCursor;
            } else {
              return buildGuestDiscoveryEnvelope(items, {
                nextCursor: encodeDiscoveryCursor(nextCursor),
                hasMore: true,
                appliedFilters: buildVenueAppliedFilters(query),
              });
            }
          }
          cursor = itemCursor;
        }

        if (chunk.length < chunkSize) {
          exhausted = true;
        }
      }

      return buildGuestDiscoveryEnvelope(items, {
        nextCursor: null,
        hasMore: false,
        appliedFilters: buildVenueAppliedFilters(query),
      });
    } catch (error: any) {
      console.error('[PublicDiscoveryService] listVenues failed', error);
      throw error;
    }
  }

  async getVenuePublicProfile(slug: string) {
    const venue = await this.venues.getBySlug(slug);
    if (!venue) return null;
    const [rawDoc, highlightsSnap, statsSnap, menuSnap, allEvents, allVenues] = await Promise.all([
      this.db
        .collection('venues')
        .doc(venue.id)
        .get()
        .catch(() => null),
      this.db
        .collection(PROFILE_HIGHLIGHTS)
        .where('profileId', '==', venue.id)
        .where('profileType', '==', 'venue')
        .get()
        .catch(() => null),
      this.db
        .collection(PROFILE_STATS)
        .doc(`venue_${venue.id}`)
        .get()
        .catch(() => null),
      this.db
        .collection(VENUE_MENU)
        .where('venueId', '==', venue.id)
        .limit(1)
        .get()
        .catch(() => null),
      this.events.queryList({
        venueId: venue.id,
        limit: 96,
        orderByField: 'startAt',
        direction: 'asc',
        minEndAt: new Date().toISOString().slice(0, 10),
      }),
      this.venues
        .queryList({
          cityKey: venue.cityKey || null,
          areaKey: venue.areaKey || null,
          limit: 24,
          orderByField: 'followersCount',
          direction: 'desc',
        })
        .catch(() => []),
    ]);
    const venueEvents = allEvents
      .filter((event: any) => event.venueId === venue.id)
      .sort((a: any, b: any) => String(a.startAt || '').localeCompare(String(b.startAt || '')));
    const menuDoc = menuSnap && !menuSnap.empty ? serializeDoc(menuSnap.docs[0]) : null;
    const similarVenues = allVenues
      .filter(
        (item: any) =>
          item.id !== venue.id &&
          (item.cityKey === venue.cityKey || item.areaKey === venue.areaKey),
      )
      .slice(0, 6);
    const rawVenue = rawDoc?.exists ? serializeDoc(rawDoc) : {};
    if (!isGuestPublicProfileEnabled({ ...rawVenue, ...venue })) return null;
    return {
      venue: projectGuestVenueDetail(rawVenue, venue, menuDoc as any),
      stats: statsSnap?.exists
        ? serializeDoc(statsSnap)
        : { followersCount: venue.followersCount, upcomingEventsCount: venue.upcomingEventsCount },
      highlights: highlightsSnap?.docs?.map(serializeDoc) || [],
      upcomingEvents: venueEvents
        .filter((event: any) => event.statusKey === 'upcoming')
        .slice(0, 6),
      pastEvents: venueEvents.filter((event: any) => event.statusKey === 'ended').slice(0, 20),
      similarVenues,
      menu: menuDoc,
    };
  }

  async search(query: string, limit = 6) {
    const needle = String(query || '')
      .trim()
      .toLowerCase();
    if (!needle) {
      return { events: [], hosts: [], venues: [] };
    }
    const candidateLimit = Math.min(Math.max(Number(limit) || 6, 1), 24) * 6;

    const [eventsResult, hostsResult, venuesResult] = await Promise.allSettled([
      this.events.querySearchPrefix(needle, candidateLimit),
      this.hosts.querySearchPrefix(needle, candidateLimit),
      this.venues.querySearchPrefix(needle, candidateLimit),
    ]);
    const events = eventsResult.status === 'fulfilled' ? eventsResult.value : [];
    const hosts = hostsResult.status === 'fulfilled' ? hostsResult.value : [];
    const venues = venuesResult.status === 'fulfilled' ? venuesResult.value : [];
    return rankGuestSearchGroups({ events, hosts, venues }, needle, limit);
  }
}
