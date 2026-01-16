const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3001/api";

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
 * Queue door entry for offline sync
 */
export async function queueDoorEntry(request: DoorEntryRequest): Promise<string> {
    // This will be implemented with AsyncStorage for offline support
    // For now, we just return a placeholder ID
    const queueId = `QUEUE-${Date.now()}`;

    // TODO: Store in AsyncStorage
    // await AsyncStorage.setItem(`door_entry_queue_${queueId}`, JSON.stringify(request));

    return queueId;
}

/**
 * Get pending door entries from offline queue
 */
export async function getPendingDoorEntries(): Promise<any[]> {
    // TODO: Implement with AsyncStorage
    return [];
}

/**
 * Sync pending door entries
 */
export async function syncPendingEntries(): Promise<{ synced: number; failed: number }> {
    // TODO: Implement sync logic
    return { synced: 0, failed: 0 };
}
