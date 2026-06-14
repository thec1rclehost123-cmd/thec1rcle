"use client";

export type SyncStatus = "idle" | "syncing" | "offline" | "error" | "ready";

export interface SyncState {
    status: SyncStatus;
    lastSynced: string | null;
    totalGuests: number;
    queuedCount: number;
    error: string | null;
}

type Listener = (state: SyncState) => void;

const DEFAULT_STATE: SyncState = {
    status: "idle",
    lastSynced: null,
    totalGuests: 0,
    queuedCount: 0,
    error: null,
};

export class GuestSyncEngine {
    private static engines = new Map<string, GuestSyncEngine>();

    static forEvent(eventId: string, venueId: string) {
        const key = `${venueId}:${eventId}`;
        const existing = GuestSyncEngine.engines.get(key);
        if (existing) return existing;
        const created = new GuestSyncEngine(eventId, venueId);
        GuestSyncEngine.engines.set(key, created);
        return created;
    }

    private listeners = new Set<Listener>();
    private started = false;
    private state: SyncState = { ...DEFAULT_STATE };

    private constructor(
        private readonly eventId: string,
        private readonly venueId: string,
    ) {}

    on(_event: "state", listener: Listener) {
        this.listeners.add(listener);
        listener(this.state);
        return () => this.listeners.delete(listener);
    }

    start() {
        if (this.started || typeof window === "undefined") return;
        this.started = true;
        window.addEventListener("online", this.handleConnectivityChange);
        window.addEventListener("offline", this.handleConnectivityChange);
        this.emit({
            status: navigator.onLine ? "ready" : "offline",
            lastSynced: navigator.onLine ? new Date().toISOString() : this.state.lastSynced,
        });
    }

    stop() {
        if (!this.started || typeof window === "undefined") return;
        this.started = false;
        window.removeEventListener("online", this.handleConnectivityChange);
        window.removeEventListener("offline", this.handleConnectivityChange);
    }

    async forceSync() {
        if (typeof window !== "undefined" && !navigator.onLine) {
            this.emit({ status: "offline", error: "Offline" });
            return;
        }

        this.emit({ status: "syncing", error: null });
        await Promise.resolve();
        this.emit({
            status: "ready",
            lastSynced: new Date().toISOString(),
            error: null,
        });
    }

    private handleConnectivityChange = () => {
        const online = typeof navigator === "undefined" ? true : navigator.onLine;
        this.emit({
            status: online ? "ready" : "offline",
            lastSynced: online ? new Date().toISOString() : this.state.lastSynced,
            error: online ? null : this.state.error,
        });
    };

    private emit(patch: Partial<SyncState>) {
        this.state = { ...this.state, ...patch };
        for (const listener of this.listeners) {
            listener(this.state);
        }
    }
}
