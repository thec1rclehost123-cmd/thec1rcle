/**
 * Offline Guestlist Sync Engine
 * Venue Dashboard v2 — Feature 5
 *
 * Responsibilities:
 * 1. Download full guestlist package every 2 minutes into IndexedDB
 * 2. Provide offline search/lookup that reads from IndexedDB
 * 3. Queue check-in mutations when offline
 * 4. Replay mutation queue on reconnect
 * 5. Expose reactive sync state for UI components
 *
 * Usage:
 *   import { GuestSyncEngine } from "@/lib/client/offlineGuestSync";
 *   const engine = GuestSyncEngine.forEvent(eventId, venueId);
 *   engine.start();
 *   engine.on("state", (s) => setSyncState(s));
 */

import {
    saveGuests,
    getGuestsByEvent,
    searchGuestsOffline,
    updateGuestLocally,
    enqueueCheckin,
    getQueuedCheckins,
    removeQueuedCheckin,
    incrementCheckinAttempts,
    saveSyncMeta,
    getSyncMeta,
    type CachedGuest,
    type QueuedCheckin,
} from "./guestIndexedDB";
import { randomUUID } from "../utils/uuid";

const SYNC_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes
const MAX_QUEUE_ATTEMPTS = 5;

export interface SyncState {
    status: "idle" | "syncing" | "online" | "offline" | "error";
    lastSynced: string | null;
    totalGuests: number;
    queuedCount: number;
    error: string | null;
}

type SyncListener = (state: SyncState) => void;

export class GuestSyncEngine {
    private readonly eventId: string;
    private readonly venueId: string;
    private interval: ReturnType<typeof setInterval> | null = null;
    private listeners: Set<SyncListener> = new Set();
    private state: SyncState = {
        status: "idle",
        lastSynced: null,
        totalGuests: 0,
        queuedCount: 0,
        error: null,
    };
    private static instances = new Map<string, GuestSyncEngine>();

    private constructor(eventId: string, venueId: string) {
        this.eventId = eventId;
        this.venueId = venueId;
    }

    static forEvent(eventId: string, venueId: string): GuestSyncEngine {
        const key = `${venueId}__${eventId}`;
        if (!GuestSyncEngine.instances.has(key)) {
            GuestSyncEngine.instances.set(key, new GuestSyncEngine(eventId, venueId));
        }
        return GuestSyncEngine.instances.get(key)!;
    }

    // ── Lifecycle ──────────────────────────────────────────────────────────────

    async start(): Promise<void> {
        // Restore cached metadata immediately
        const meta = await getSyncMeta(this.eventId);
        if (meta) {
            this.emit({
                status: "online",
                lastSynced: meta.lastSynced,
                totalGuests: meta.totalGuests,
                queuedCount: 0,
                error: null,
            });
        }

        // First sync immediately, then every 2 min
        await this.sync();

        this.interval = setInterval(() => this.sync(), SYNC_INTERVAL_MS);

        // Listen for online/offline
        window.addEventListener("online", this.handleOnline);
        window.addEventListener("offline", this.handleOffline);
    }

    stop(): void {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        window.removeEventListener("online", this.handleOnline);
        window.removeEventListener("offline", this.handleOffline);
        GuestSyncEngine.instances.delete(`${this.venueId}__${this.eventId}`);
    }

    // ── Events ─────────────────────────────────────────────────────────────────

    on(event: "state", listener: SyncListener): () => void {
        this.listeners.add(listener);
        // Emit current state immediately
        listener(this.state);
        return () => this.listeners.delete(listener);
    }

    private emit(state: Partial<SyncState>): void {
        this.state = { ...this.state, ...state };
        this.listeners.forEach((l) => l(this.state));
    }

    // ── Sync ───────────────────────────────────────────────────────────────────

    async sync(): Promise<void> {
        if (!navigator.onLine) {
            this.emit({ status: "offline" });
            return;
        }

        this.emit({ status: "syncing", error: null });

        try {
            const res = await fetch(
                `/api/venue/guestlist-package/${this.eventId}?venueId=${this.venueId}`,
                { cache: "no-store" }
            );

            if (!res.ok) {
                throw new Error(`HTTP ${res.status}`);
            }

            const data = await res.json();
            const guests: CachedGuest[] = (data.guests ?? []).map((g: any) => ({
                ...g,
                _key: `${this.eventId}__${g.id}`,
                eventId: this.eventId,
            }));

            await saveGuests(guests);
            await saveSyncMeta({
                eventId: this.eventId,
                lastSynced: new Date().toISOString(),
                totalGuests: guests.length,
                etag: res.headers.get("etag"),
            });

            const queued = await getQueuedCheckins(this.eventId);

            this.emit({
                status: "online",
                lastSynced: new Date().toISOString(),
                totalGuests: guests.length,
                queuedCount: queued.length,
                error: null,
            });

            // Replay queue after successful sync
            await this.replayQueue();
        } catch (err: any) {
            this.emit({ status: "error", error: err.message });
        }
    }

    // Force refresh
    async forceSync(): Promise<void> {
        await this.sync();
    }

    // ── Offline operations ─────────────────────────────────────────────────────

    async searchGuests(q: string): Promise<CachedGuest[]> {
        return searchGuestsOffline(this.eventId, q);
    }

    async getAllGuests(): Promise<CachedGuest[]> {
        return getGuestsByEvent(this.eventId);
    }

    /**
     * Check in a guest.
     * If online: calls API directly.
     * If offline: updates IDB locally and queues the mutation.
     */
    async checkIn(
        guestId: string,
        actor: string,
        gate: string = "main"
    ): Promise<{ success: boolean; queued: boolean; error?: string }> {
        const key = `${this.eventId}__${guestId}`;
        const idempotencyKey = randomUUID();

        if (navigator.onLine) {
            try {
                const res = await fetch(
                    `/api/venue/guest-ops/${this.eventId}/guests/${guestId}/check-in`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ reason: "scan", gate, idempotencyKey }),
                    }
                );

                if (!res.ok) {
                    const err = await res.json();
                    return { success: false, queued: false, error: err.error };
                }

                // Update local cache
                await updateGuestLocally(key, {
                    checkedIn: true,
                    checkedInAt: new Date().toISOString(),
                    status: "checked_in",
                });

                return { success: true, queued: false };
            } catch {
                // Network error — fall through to offline queue
            }
        }

        // Offline path: optimistic local update + queue
        await updateGuestLocally(key, {
            checkedIn: true,
            checkedInAt: new Date().toISOString(),
            status: "checked_in",
        });

        await enqueueCheckin({
            id: randomUUID(),
            eventId: this.eventId,
            guestId,
            actor,
            gate,
            queuedAt: new Date().toISOString(),
            idempotencyKey,
        });

        const queued = await getQueuedCheckins(this.eventId);
        this.emit({ queuedCount: queued.length });

        return { success: true, queued: true };
    }

    // ── Queue replay ───────────────────────────────────────────────────────────

    private async replayQueue(): Promise<void> {
        const items = await getQueuedCheckins(this.eventId);
        if (items.length === 0) return;

        for (const item of items) {
            if (item.attempts >= MAX_QUEUE_ATTEMPTS) {
                console.warn("[GuestSync] Dropping queued check-in after max attempts:", item);
                await removeQueuedCheckin(item.id);
                continue;
            }

            try {
                const res = await fetch(
                    `/api/venue/guest-ops/${item.eventId}/guests/${item.guestId}/check-in`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            reason: "scan_offline_replay",
                            gate: item.gate,
                            idempotencyKey: item.idempotencyKey,
                        }),
                    }
                );

                if (res.ok || res.status === 409) {
                    // 409 = already checked in (idempotent) — still remove from queue
                    await removeQueuedCheckin(item.id);
                } else {
                    await incrementCheckinAttempts(item.id);
                }
            } catch {
                await incrementCheckinAttempts(item.id);
            }
        }

        const remaining = await getQueuedCheckins(this.eventId);
        this.emit({ queuedCount: remaining.length });
    }

    // ── Network handlers ───────────────────────────────────────────────────────

    private handleOnline = async (): Promise<void> => {
        await this.sync();
    };

    private handleOffline = (): void => {
        this.emit({ status: "offline" });
    };
}
