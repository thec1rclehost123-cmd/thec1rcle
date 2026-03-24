import {
    ScannerEventData,
    ScanRequest,
    ScanResponse,
    DoorEntryRequest,
    DoorEntryResponse,
    Guest,
    WalletContext,
    DebitRequest,
    DebitResponse,
    WalkInRequest,
    WalkInResponse,
    WalkInEntry,
} from "./types";
import * as SecureStore from "expo-secure-store";

// C2: Use GATEWAY_URL — not the guest-portal base URL
const GATEWAY_URL = process.env.EXPO_PUBLIC_GATEWAY_URL || "http://localhost:4000";
const SCAN_API    = `${GATEWAY_URL}/api/v1/scan`;
const WALLET_API  = `${GATEWAY_URL}/api/v1/cover-charge`;
const DEVICE_ID_KEY = "c1rcle_scanner_device_id";

// ── Timeout helper ─────────────────────────────────────────────────────────
function makeAbort(ms: number): { signal: AbortSignal; cleanup: () => void } {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), ms);
    return { signal: ctrl.signal, cleanup: () => clearTimeout(id) };
}

// ── Local scan cache — LRU 100 entries ────────────────────────────────────
// Instant local duplicate detection — 0ms, 0 network
const CACHE_MAX = 100;
const _cache = new Map<string, { result: "valid" | "already_scanned"; scannedAt: string }>();

export function cacheAdd(key: string, result: "valid" | "already_scanned"): void {
    if (_cache.size >= CACHE_MAX) _cache.delete(_cache.keys().next().value!);
    _cache.set(key, { result, scannedAt: new Date().toISOString() });
}

export function cacheCheck(key: string) { return _cache.get(key) ?? null; }
export function cacheClear(): void { _cache.clear(); } // call on clearEvent

function withScannerAuth(
    sessionToken?: string,
    headers: Record<string, string> = {},
): Record<string, string> {
    if (!sessionToken) return headers;
    return {
        ...headers,
        Authorization: `Bearer ${sessionToken}`,
    };
}

function buildSessionError(status: number, data: any): ScanResponse | null {
    if (status !== 401) return null;
    return {
        success: false,
        result: "session_expired",
        error: data?.error || "Scanner session expired",
    };
}

function generateDeviceId(): string {
    const random = Math.random().toString(36).slice(2, 10);
    return `scanner_${Date.now().toString(36)}_${random}`;
}

export async function getScannerDeviceId(): Promise<string> {
    const existing = await SecureStore.getItemAsync(DEVICE_ID_KEY);
    if (existing) return existing;

    const next = generateDeviceId();
    await SecureStore.setItemAsync(DEVICE_ID_KEY, next);
    return next;
}

export async function registerScannerDevice(
    venueId: string,
    sessionToken: string,
    deviceName = "C1RCLE Scanner",
): Promise<{ success: boolean; error?: string; deviceId?: string }> {
    const { signal, cleanup } = makeAbort(8000);
    try {
        const deviceId = await getScannerDeviceId();
        const res = await fetch(`${SCAN_API}/devices`, {
            method: "POST",
            headers: withScannerAuth(sessionToken, { "Content-Type": "application/json" }),
            body: JSON.stringify({ deviceId, venueId, deviceName }),
            signal,
        });
        cleanup();
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
            return { success: false, error: data.error || "Failed to register device" };
        }

        return { success: true, deviceId: data.deviceId || deviceId };
    } catch (err: any) {
        cleanup();
        if (__DEV__) {
            return { success: true, deviceId: `dev_mock_${Date.now()}` };
        }
        return {
            success: false,
            error: err.name === "AbortError" ? "Device registration timed out" : "Unable to register device",
        };
    }
}

// ── Event Code Validation ──────────────────────────────────────────────────
export async function validateEventCode(code: string): Promise<ScannerEventData> {
    const { signal, cleanup } = makeAbort(8000);
    try {
        const res = await fetch(`${SCAN_API}/auth`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code }),
            signal,
        });
        cleanup();
        const data = await res.json();
        if (!res.ok) {
            return {
                valid: false, code, event: {} as any,
                permissions: { canScan: false, canDoorEntry: false, canWalkIn: false, canCharge: false },
                tiers: [], error: data.error || "Invalid code",
            };
        }
        return { valid: true, code, ...data };
    } catch (err: any) {
        cleanup();
        if (__DEV__) return getMockEventData(code);
        throw new Error(err.name === "AbortError" ? "Connection timed out" : "Unable to connect");
    }
}

// ── QR Scan ────────────────────────────────────────────────────────────────
export async function processQRScan(
    request: ScanRequest,
    sessionToken?: string,
): Promise<ScanResponse> {
    // Instant local duplicate check — no network needed
    const cacheKey = `${request.eventId}:${request.qrData}`;
    const cached = cacheCheck(cacheKey);
    if (cached?.result === "valid") {
        return {
            success: false, result: "already_scanned",
            error: "Already scanned this session",
            previousScan: { scannedAt: cached.scannedAt, scannedBy: { name: "This device", role: "door_staff" } },
        };
    }

    const { signal, cleanup } = makeAbort(5000); // scan-and-go: hard 5s
    try {
        const deviceId = await getScannerDeviceId();
        const res = await fetch(`${SCAN_API}`, {
            method: "POST",
            headers: withScannerAuth(sessionToken, { "Content-Type": "application/json" }),
            body: JSON.stringify({
                qrData: request.qrData,
                eventId: request.eventId,
                eventCode: request.eventCode,
                deviceId,
                venueId: request.venueId,
                gate: request.gate,
                scannedBy: { uid: `scanner_${request.eventCode}`, name: "Scanner", role: "door_staff" },
            }),
            signal,
        });
        cleanup();
        const data = await res.json();
        const sessionError = buildSessionError(res.status, data);
        if (sessionError) return sessionError;
        if (data.result === "valid") cacheAdd(cacheKey, "valid");
        if (data.result === "already_scanned") cacheAdd(cacheKey, "already_scanned");
        if (!res.ok) {
            return {
                success: false, result: data.result || "invalid",
                error: data.error || "Scan failed",
                previousScan: data.previousScan,
            };
        }
        return { success: true, ...data };
    } catch (err: any) {
        cleanup();
        if (__DEV__) return simulateScan(request.qrData);
        return {
            success: false, result: "network_error",
            error: err.name === "AbortError" ? "Scan timed out — re-present ticket" : "Connection error",
        };
    }
}

// ── Staff deny (fire-and-forget audit log) ─────────────────────────────────
export function recordStaffDeny(payload: {
    qrData: string; eventId: string; eventCode: string; gate?: string; reason: string;
}, sessionToken?: string): void {
    const { signal, cleanup } = makeAbort(5000);
    fetch(`${SCAN_API}/staff-deny`, {
        method: "POST",
        headers: withScannerAuth(sessionToken, { "Content-Type": "application/json" }),
        body: JSON.stringify(payload),
        signal,
    }).finally(cleanup).catch(() => {});
}

// ── Door Entry ─────────────────────────────────────────────────────────────
export async function createDoorEntry(
    request: DoorEntryRequest,
    sessionToken?: string,
): Promise<DoorEntryResponse> {
    const { signal, cleanup } = makeAbort(8000);
    try {
        const res = await fetch(`${SCAN_API}/door-entry`, {
            method: "POST",
            headers: withScannerAuth(sessionToken, { "Content-Type": "application/json" }),
            body: JSON.stringify(request),
            signal,
        });
        cleanup();
        const data = await res.json();
        const sessionError = buildSessionError(res.status, data);
        if (sessionError) {
            return { success: false, error: sessionError.error };
        }
        if (!res.ok) return { success: false, error: data.error || "Failed to create entry" };
        return { success: true, ...data };
    } catch (err: any) {
        cleanup();
        if (__DEV__) return simulateDoorEntry(request);
        throw new Error(err.name === "AbortError" ? "Request timed out" : "Unable to connect");
    }
}

// ── Guest List ─────────────────────────────────────────────────────────────
export async function fetchGuestList(
    eventId: string,
    eventCode: string,
    sessionToken?: string,
): Promise<Guest[]> {
    const { signal, cleanup } = makeAbort(10000);
    try {
        const res = await fetch(`${SCAN_API}/guestlist?eventId=${eventId}&eventCode=${eventCode}`, {
            headers: withScannerAuth(sessionToken),
            signal,
        });
        cleanup();
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to fetch guests");
        return data.guests || [];
    } catch {
        cleanup();
        if (__DEV__) return getMockGuests();
        return [];
    }
}

// ── Stats ──────────────────────────────────────────────────────────────────
export async function refreshEventStats(code: string, sessionToken?: string): Promise<any> {
    const { signal, cleanup } = makeAbort(8000);
    try {
        const res = await fetch(`${SCAN_API}/stats?code=${code}`, {
            headers: withScannerAuth(sessionToken),
            signal,
        });
        cleanup();
        return await res.json();
    } catch { cleanup(); return null; }
}

// ── Wallet lookup by orderId (H3) ──────────────────────────────────────────
export async function fetchWalletByOrder(
    orderId: string,
    sessionToken: string,
): Promise<{ wallet: WalletContext } | { error: string }> {
    const { signal, cleanup } = makeAbort(10000);
    try {
        const res = await fetch(`${WALLET_API}/wallet/by-order/${encodeURIComponent(orderId)}`, {
            headers: { Authorization: `Bearer ${sessionToken}` },
            signal,
        });
        cleanup();
        const data = await res.json();
        if (!res.ok) return { error: data.error || "Wallet not found" };
        return data;
    } catch (err: any) {
        cleanup();
        return { error: err.name === "AbortError" ? "Wallet lookup timed out" : "Network error" };
    }
}

// ── Debit ──────────────────────────────────────────────────────────────────
export async function submitDebit(
    request: DebitRequest,
    sessionToken: string,
): Promise<DebitResponse> {
    const { signal, cleanup } = makeAbort(10000);
    try {
        const res = await fetch(`${WALLET_API}/debit`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
            body: JSON.stringify(request),
            signal,
        });
        cleanup();
        const data = await res.json();
        if (!res.ok) return { success: false, error: data.message || data.error || "Charge failed" };
        return { success: true, balanceAfterPaise: data.balanceAfterPaise, receipt: data.receipt };
    } catch (err: any) {
        cleanup();
        return { success: false, error: err.name === "AbortError" ? "Timed out — safe to retry" : "Network error" };
    }
}

// ── Manual check-in from guestlist ────────────────────────────────────────
export async function manualCheckIn(
    orderId: string,
    eventId: string,
    eventCode: string,
    sessionToken?: string,
): Promise<{ success: boolean; error?: string }> {
    const { signal, cleanup } = makeAbort(8000);
    try {
        const res = await fetch(`${SCAN_API}/guestlist/check-in`, {
            method: "POST",
            headers: withScannerAuth(sessionToken, { "Content-Type": "application/json" }),
            body: JSON.stringify({ orderId, eventId, eventCode }),
            signal,
        });
        cleanup();
        const data = await res.json();
        return res.ok ? { success: true } : { success: false, error: data.error };
    } catch (err: any) {
        cleanup();
        return { success: false, error: "Network error" };
    }
}

// ── Walk-ins ───────────────────────────────────────────────────────────────
export async function createWalkIn(
    request: WalkInRequest,
    sessionToken?: string,
): Promise<WalkInResponse> {
    const { signal, cleanup } = makeAbort(8000);
    try {
        const res = await fetch(`${SCAN_API}/walk-in`, {
            method: "POST",
            headers: withScannerAuth(sessionToken, { "Content-Type": "application/json" }),
            body: JSON.stringify(request),
            signal,
        });
        cleanup();
        const data = await res.json();
        const sessionError = buildSessionError(res.status, data);
        if (sessionError) {
            return { success: false, error: sessionError.error };
        }
        if (!res.ok) return { success: false, error: data.error || "Failed to log walk-in" };
        return { success: true, walkInId: data.walkInId };
    } catch (err: any) {
        cleanup();
        if (__DEV__) {
            return { success: true, walkInId: `wi_dev_${Date.now()}` };
        }
        throw new Error(err.name === "AbortError" ? "Request timed out" : "Unable to connect");
    }
}

export async function fetchWalkIns(
    eventId: string,
    eventCode: string,
    sessionToken?: string,
): Promise<WalkInEntry[]> {
    const { signal, cleanup } = makeAbort(10000);
    try {
        const res = await fetch(`${SCAN_API}/walk-in?eventId=${eventId}&eventCode=${eventCode}&limit=50`, {
            headers: withScannerAuth(sessionToken),
            signal,
        });
        cleanup();
        if (!res.ok) return [];
        const data = await res.json();
        return data.walkIns || [];
    } catch (err) {
        cleanup();
        console.error("[fetchWalkIns] Error:", err);
        if (__DEV__) {
            return getMockWalkIns();
        }
        return [];
    }
}

// ── Connection pre-warm ───────────────────────────────────────────────────
// Fires a cheap request to warm the TCP connection before the first scan hits
export function prewarmConnection(code: string, sessionToken?: string): void {
    const { signal, cleanup } = makeAbort(3000);
    fetch(`${SCAN_API}/stats?code=${encodeURIComponent(code)}`, {
        headers: withScannerAuth(sessionToken),
        signal,
    }).finally(cleanup).catch(() => {});
}

// ═════════════════════════════════════════════════════════════════════════════
// Dev Mock Data
// ═════════════════════════════════════════════════════════════════════════════

function getMockEventData(code: string): ScannerEventData {
    return {
        valid: true, code,
        sessionToken: "mock-session-token-dev",
        sessionExpiresAt: new Date(Date.now() + 12 * 3600000).toISOString(),
        event: {
            id: "evt_demo_123", title: "Saturday Night Live", venue: "Club Paradiso",
            venueId: "venue_demo_456", date: new Date().toISOString().split("T")[0],
            startTime: "22:00", endTime: "04:00", capacity: 500,
        },
        permissions: { canScan: true, canDoorEntry: true, canWalkIn: true, canCharge: false },
        tiers: [
            { id: "tier_stag", name: "Stag Entry", price: 500, entryType: "stag", available: true },
            { id: "tier_couple", name: "Couple Entry", price: 800, entryType: "couple", available: true },
            { id: "tier_vip", name: "VIP Entry", price: 2000, entryType: "vip", available: true },
        ],
        gate: "Main Gate",
        stats: { totalEntered: 127, prebooked: 89, doorEntries: 38, doorRevenue: 24500 },
    };
}

function simulateScan(qrData: string): ScanResponse {
    try {
        const parsed = JSON.parse(qrData);
        const r = Math.random();
        if (r < 0.7) {
            return {
                success: true, result: "valid", scanId: `scan_${Date.now()}`,
                message: "Entry approved",
                ticket: {
                    orderId: parsed.o || "demo_order", eventId: parsed.e || "demo_event",
                    eventTitle: "Demo Event", ticketName: parsed.n || "General Entry",
                    quantity: parsed.q || 1, entryType: parsed.et || "general",
                    userName: "Demo Guest", userEmail: "guest@demo.com",
                },
            };
        } else if (r < 0.85) {
            return {
                success: false, result: "already_scanned", error: "Ticket already scanned",
                previousScan: {
                    scannedAt: new Date(Date.now() - 3600000).toISOString(),
                    scannedBy: { name: "Staff Member", role: "security" },
                },
            };
        }
        return { success: false, result: "invalid", error: "Invalid QR code" };
    } catch {
        return { success: false, result: "invalid", error: "Could not parse QR code" };
    }
}

function simulateDoorEntry(request: DoorEntryRequest): DoorEntryResponse {
    const orderId = `DOOR-${Date.now().toString(36).toUpperCase()}`;
    return {
        success: true, orderId,
        entryId: `ENT-${Date.now().toString(36).toUpperCase()}`,
        qrData: JSON.stringify({
            o: orderId, e: request.eventId, t: request.tierId,
            n: request.tierName, u: `guest_${Date.now()}`,
            q: request.quantity, et: request.entryType, rt: 0, ts: Date.now(), v: 1,
        }),
    };
}

function getMockGuests(): Guest[] {
    const names = [
        "Arjun Sharma", "Priya Patel", "Rahul Verma", "Ananya Singh",
        "Vikram Kapoor", "Neha Gupta", "Rohan Malhotra", "Kavya Reddy",
        "Aditya Kumar", "Ishita Joshi", "Karan Mehta", "Pooja Nair",
    ];
    const types = [
        { name: "Stag Entry", entryType: "stag" },
        { name: "Couple Entry", entryType: "couple" },
        { name: "VIP Entry", entryType: "vip" },
    ];
    return names.map((name, i) => {
        const ticket = types[i % types.length];
        const entered = Math.random() > 0.4;
        return {
            id: `guest_${i}`, name, ticketType: ticket.name,
            entryType: ticket.entryType,
            quantity: ticket.entryType === "couple" ? 2 : 1,
            source: Math.random() > 0.75 ? ("door" as const) : ("online" as const),
            status: entered ? ("entered" as const) : ("not_entered" as const),
            enteredAt: entered ? new Date(Date.now() - Math.random() * 3600000).toISOString() : undefined,
        };
    });
}

function getMockWalkIns(): WalkInEntry[] {
    return [
        { id: "wi_1", guestName: "Rahul Sharma", guestAge: 24, phoneHash: "8901", addedAt: new Date(Date.now() - 300000).toISOString() },
        { id: "wi_2", guestName: "Priya Mehta", guestAge: 22, phoneHash: "4532", addedAt: new Date(Date.now() - 600000).toISOString() },
        { id: "wi_3", guestName: "Arjun Kapoor", guestAge: 27, addedAt: new Date(Date.now() - 900000).toISOString() },
    ];
}
