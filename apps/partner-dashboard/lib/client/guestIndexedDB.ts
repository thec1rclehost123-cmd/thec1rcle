/**
 * Guestlist IndexedDB schema and access layer
 * Venue Dashboard v2 — Feature 5
 *
 * DB name: c1rcle_guest_ops
 * Stores:
 *   guests      — cached guest documents keyed by eventId+guestId
 *   checkins    — queued check-in mutations to replay on reconnect
 *   meta        — per-event sync metadata (lastSynced, etag, etc.)
 */

const DB_NAME = 'c1rcle_guest_ops';
const DB_VERSION = 1;

export interface CachedGuest {
  id: string;
  eventId: string;
  guestName: string;
  phone: string; // masked per policy
  ticketId: string;
  status: 'active' | 'checked_in' | 'denied';
  guestType: string;
  tierName: string;
  checkedIn: boolean;
  checkedInAt: string | null;
  hostId: string | null;
  promoterId: string | null;
  // composite key used as IDB key
  _key: string; // `${eventId}__${id}`
}

export interface QueuedCheckin {
  id: string; // UUID
  eventId: string;
  guestId: string;
  actor: string;
  gate: string;
  queuedAt: string;
  attempts: number;
  idempotencyKey: string;
}

export interface SyncMeta {
  eventId: string;
  lastSynced: string | null;
  totalGuests: number;
  etag: string | null;
}

let _db: IDBDatabase | null = null;

function openDB(): Promise<IDBDatabase> {
  if (_db) return Promise.resolve(_db);

  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Guests store
      if (!db.objectStoreNames.contains('guests')) {
        const guestStore = db.createObjectStore('guests', { keyPath: '_key' });
        guestStore.createIndex('byEventId', 'eventId');
        guestStore.createIndex('byTicketId', ['eventId', 'ticketId']);
        guestStore.createIndex('byName', ['eventId', 'guestName']);
      }

      // Queued check-ins
      if (!db.objectStoreNames.contains('checkins')) {
        const ciStore = db.createObjectStore('checkins', { keyPath: 'id' });
        ciStore.createIndex('byEventId', 'eventId');
      }

      // Sync metadata
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'eventId' });
      }
    };

    req.onsuccess = () => {
      _db = req.result;
      resolve(_db);
    };

    req.onerror = () => reject(req.error);
  });
}

// ── Guests ─────────────────────────────────────────────────────────────────────

export async function saveGuests(guests: CachedGuest[]): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('guests', 'readwrite');
  const store = tx.objectStore('guests');
  for (const g of guests) {
    store.put(g);
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getGuestsByEvent(eventId: string): Promise<CachedGuest[]> {
  const db = await openDB();
  const tx = db.transaction('guests', 'readonly');
  const store = tx.objectStore('guests');
  const idx = store.index('byEventId');
  const req = idx.getAll(eventId);
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result as CachedGuest[]);
    req.onerror = () => reject(req.error);
  });
}

export async function searchGuestsOffline(eventId: string, q: string): Promise<CachedGuest[]> {
  const all = await getGuestsByEvent(eventId);
  const ql = q.toLowerCase().trim();
  if (!ql) return all;

  return all.filter(
    (g) =>
      g.guestName.toLowerCase().includes(ql) ||
      g.ticketId.toLowerCase().includes(ql) ||
      g.phone.includes(ql),
  );
}

export async function updateGuestLocally(
  key: string,
  updates: Partial<CachedGuest>,
): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('guests', 'readwrite');
  const store = tx.objectStore('guests');
  const existing: CachedGuest = await new Promise((res, rej) => {
    const r = store.get(key);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
  if (existing) {
    store.put({ ...existing, ...updates });
  }
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Check-in queue ─────────────────────────────────────────────────────────────

export async function enqueueCheckin(item: Omit<QueuedCheckin, 'attempts'>): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('checkins', 'readwrite');
  tx.objectStore('checkins').put({ ...item, attempts: 0 });
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getQueuedCheckins(eventId: string): Promise<QueuedCheckin[]> {
  const db = await openDB();
  const tx = db.transaction('checkins', 'readonly');
  const idx = tx.objectStore('checkins').index('byEventId');
  const req = idx.getAll(eventId);
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result as QueuedCheckin[]);
    req.onerror = () => reject(req.error);
  });
}

export async function removeQueuedCheckin(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('checkins', 'readwrite');
  tx.objectStore('checkins').delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function incrementCheckinAttempts(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('checkins', 'readwrite');
  const store = tx.objectStore('checkins');
  const req = store.get(id);
  req.onsuccess = () => {
    const item = req.result as QueuedCheckin;
    if (item) {
      store.put({ ...item, attempts: item.attempts + 1 });
    }
  };
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── Sync meta ──────────────────────────────────────────────────────────────────

export async function getSyncMeta(eventId: string): Promise<SyncMeta | null> {
  const db = await openDB();
  const tx = db.transaction('meta', 'readonly');
  const req = tx.objectStore('meta').get(eventId);
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve((req.result as SyncMeta) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function saveSyncMeta(meta: SyncMeta): Promise<void> {
  const db = await openDB();
  const tx = db.transaction('meta', 'readwrite');
  tx.objectStore('meta').put(meta);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearEventCache(eventId: string): Promise<void> {
  const db = await openDB();
  const guests = await getGuestsByEvent(eventId);

  const tx = db.transaction(['guests', 'meta'], 'readwrite');
  const guestStore = tx.objectStore('guests');
  for (const g of guests) {
    guestStore.delete(g._key);
  }
  tx.objectStore('meta').delete(eventId);

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
