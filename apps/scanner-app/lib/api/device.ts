import * as SecureStore from "expo-secure-store";

const DEVICE_ID_KEY = "c1rcle_scanner_device_id";
const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3001/api";

function generateDeviceId(): string {
    const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    let id = "dev_";
    for (let i = 0; i < 16; i++) {
        id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
}

/**
 * Get the stored device ID, or generate one if not set.
 */
export async function getDeviceId(): Promise<string> {
    let id = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (!id) {
        id = generateDeviceId();
        await SecureStore.setItemAsync(DEVICE_ID_KEY, id);
    }
    return id;
}

/**
 * Register this device with a venue. Safe to call multiple times — the server
 * will upsert the binding and refresh lastActiveAt.
 */
export async function registerDevice(venueId: string, deviceName?: string): Promise<void> {
    try {
        const deviceId = await getDeviceId();
        await fetch(`${API_BASE}/scan/devices`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ deviceId, venueId, deviceName }),
        });
    } catch (error) {
        // Non-fatal — scanner still works without device registration
        console.warn("[registerDevice] Could not register device:", error);
    }
}
