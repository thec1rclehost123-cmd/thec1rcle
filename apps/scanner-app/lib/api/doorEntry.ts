import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3001/api";
const QUEUE_PREFIX = "door_entry_queue_";

interface DoorEntryRequest {
    eventCode: string;
    eventId: string;
    guestName: string;
    guestPhone?: string;
    tierId: string;
    tierName: string;
    entryType: string;
    quantity: number;
    unitPrice: number;
    totalAmount: number;
    paymentMethod: "cash" | "upi" | "card";
    gate?: string;
}

interface DoorEntryResponse {
    success: boolean;
    orderId?: string;
    entryId?: string;
    qrData?: string;
    error?: string;
}

/**
 * Create a door entry (walk-up sale)
 */
export async function createDoorEntry(request: DoorEntryRequest): Promise<DoorEntryResponse> {
    try {
        const response = await fetch(`${API_BASE}/door-entry`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(request),
        });

        const data = await response.json();

        if (!response.ok) {
            return {
                success: false,
                error: data.error || "Failed to create entry",
            };
        }

        return {
            success: true,
            ...data,
        };
    } catch (error: any) {
        console.error("[createDoorEntry] Error:", error);

        // For development, simulate success
        if (__DEV__) {
            return simulateDoorEntry(request);
        }

        throw new Error("Unable to connect to server");
    }
}

/**
 * Simulate door entry for development
 */
function simulateDoorEntry(request: DoorEntryRequest): DoorEntryResponse {
    const orderId = `DOOR-${Date.now().toString(36).toUpperCase()}`;

    // Create mock QR payload
    const qrPayload = {
        o: orderId,
        e: request.eventId,
        t: request.tierId,
        n: request.tierName,
        u: `guest_${Date.now()}`,
        q: request.quantity,
        et: request.entryType,
        ts: Date.now(),
        v: 1,
        sig: "mock_signature",
    };

    return {
        success: true,
        orderId,
        entryId: `ENT-${Date.now().toString(36).toUpperCase()}`,
        qrData: JSON.stringify(qrPayload),
    };
}

/**
 * Queue a door entry for offline sync (used when network is unavailable).
 * Returns a queue ID that can be used to track this entry.
 */
export async function queueDoorEntry(request: DoorEntryRequest): Promise<string> {
    const queueId = `QUEUE-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const key = `${QUEUE_PREFIX}${queueId}`;
    await AsyncStorage.setItem(key, JSON.stringify({ ...request, _queueId: queueId, _queuedAt: new Date().toISOString() }));
    return queueId;
}

/**
 * Get all pending door entries from the offline queue.
 */
export async function getPendingDoorEntries(): Promise<Array<DoorEntryRequest & { _queueId: string; _queuedAt: string }>> {
    const allKeys = await AsyncStorage.getAllKeys();
    const queueKeys = allKeys.filter((k) => k.startsWith(QUEUE_PREFIX));
    if (queueKeys.length === 0) return [];
    const pairs = await AsyncStorage.multiGet(queueKeys);
    return pairs
        .map(([, value]) => (value ? JSON.parse(value) : null))
        .filter(Boolean);
}

/**
 * Sync all queued door entries to the server.
 * Removes successfully synced entries from the queue.
 */
export async function syncPendingEntries(): Promise<{ synced: number; failed: number }> {
    const pending = await getPendingDoorEntries();
    let synced = 0;
    let failed = 0;

    for (const entry of pending) {
        const { _queueId, _queuedAt, ...request } = entry;
        try {
            const result = await createDoorEntry(request as DoorEntryRequest);
            if (result.success) {
                await AsyncStorage.removeItem(`${QUEUE_PREFIX}${_queueId}`);
                synced++;
            } else {
                failed++;
            }
        } catch {
            failed++;
        }
    }

    return { synced, failed };
}
