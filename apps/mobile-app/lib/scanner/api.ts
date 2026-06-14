import {
  ScannerEventData,
  ScanRequest,
  ScanResponse,
  DoorEntryRequest,
  DoorEntryResponse,
  Guest,
} from "./types";

// Use the partner-dashboard API for scan endpoints (same backend that the scanner-app used)
const API_BASE = process.env.EXPO_PUBLIC_API_BASE_URL || "https://thec1rcle.com";
const SCAN_API = `${API_BASE}/api`;

// ════════════════════════════════════════════════════════════════
// Event Code Validation
// ════════════════════════════════════════════════════════════════

export async function validateEventCode(code: string): Promise<ScannerEventData> {
  try {
    const response = await fetch(`${SCAN_API}/scan/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        valid: false,
        code,
        event: {} as any,
        permissions: { canScan: false, canDoorEntry: false },
        tiers: [],
        error: data.error || "Invalid code",
      };
    }

    return { valid: true, code, ...data };
  } catch (error: any) {
    console.error("[Scanner] validateEventCode error:", error);

    // Dev fallback with mock data
    if (__DEV__) return getMockEventData(code);
    throw new Error("Unable to connect to server");
  }
}

export async function refreshEventStats(code: string): Promise<any> {
  try {
    const response = await fetch(`${SCAN_API}/scan/stats?code=${code}`);
    return await response.json();
  } catch (error) {
    console.error("[Scanner] refreshEventStats error:", error);
    return null;
  }
}

// ════════════════════════════════════════════════════════════════
// QR Scan Processing
// ════════════════════════════════════════════════════════════════

export async function processQRScan(request: ScanRequest): Promise<ScanResponse> {
  try {
    const response = await fetch(`${SCAN_API}/scan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        qrData: request.qrData,
        eventId: request.eventId,
        eventCode: request.eventCode,
        gate: request.gate,
        scannedBy: {
          uid: `scanner_${request.eventCode}`,
          name: "Scanner",
          role: "door_staff",
        },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        result: data.result || "invalid",
        error: data.error || "Scan failed",
        previousScan: data.previousScan,
      };
    }

    return { success: true, ...data };
  } catch (error: any) {
    console.error("[Scanner] processQRScan error:", error);
    if (__DEV__) return simulateScan(request.qrData);
    throw new Error("Unable to connect to server");
  }
}

// ════════════════════════════════════════════════════════════════
// Door Entry
// ════════════════════════════════════════════════════════════════

export async function createDoorEntry(request: DoorEntryRequest): Promise<DoorEntryResponse> {
  try {
    const response = await fetch(`${SCAN_API}/door-entry`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    const data = await response.json();

    if (!response.ok) {
      return { success: false, error: data.error || "Failed to create entry" };
    }

    return { success: true, ...data };
  } catch (error: any) {
    console.error("[Scanner] createDoorEntry error:", error);
    if (__DEV__) return simulateDoorEntry(request);
    throw new Error("Unable to connect to server");
  }
}

// ════════════════════════════════════════════════════════════════
// Guest List
// ════════════════════════════════════════════════════════════════

export async function fetchGuestList(eventId: string, eventCode: string): Promise<Guest[]> {
  try {
    const response = await fetch(`${SCAN_API}/guestlist?eventId=${eventId}&eventCode=${eventCode}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Failed to fetch guests");
    return data.guests || [];
  } catch (error: any) {
    console.error("[Scanner] fetchGuestList error:", error);
    if (__DEV__) return getMockGuests();
    return [];
  }
}

export async function searchGuests(
  eventId: string,
  eventCode: string,
  query: string,
): Promise<Guest[]> {
  const guests = await fetchGuestList(eventId, eventCode);
  const lower = query.toLowerCase();
  return guests.filter((g) => g.name.toLowerCase().includes(lower));
}

// ════════════════════════════════════════════════════════════════
// Dev Mock Data
// ════════════════════════════════════════════════════════════════

function getMockEventData(code: string): ScannerEventData {
  return {
    valid: true,
    code,
    event: {
      id: "evt_demo_123",
      title: "Saturday Night Live",
      venue: "Club Paradiso",
      venueId: "venue_demo_456",
      date: new Date().toISOString().split("T")[0],
      startTime: "22:00",
      endTime: "04:00",
      capacity: 500,
    },
    permissions: { canScan: true, canDoorEntry: true },
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
        success: true,
        result: "valid",
        scanId: `scan_${Date.now()}`,
        message: "Entry approved!",
        ticket: {
          orderId: parsed.o || "demo_order",
          eventId: parsed.e || "demo_event",
          eventTitle: "Demo Event",
          ticketName: parsed.n || "General Entry",
          quantity: parsed.q || 1,
          entryType: parsed.et || "general",
          userName: "Demo Guest",
          userEmail: "guest@demo.com",
        },
      };
    } else if (r < 0.85) {
      return {
        success: false,
        result: "already_scanned",
        error: "Ticket already scanned",
        previousScan: {
          scannedAt: new Date(Date.now() - 3600000).toLocaleTimeString(),
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
    success: true,
    orderId,
    entryId: `ENT-${Date.now().toString(36).toUpperCase()}`,
    qrData: JSON.stringify({
      o: orderId,
      e: request.eventId,
      t: request.tierId,
      n: request.tierName,
      u: `guest_${Date.now()}`,
      q: request.quantity,
      et: request.entryType,
      ts: Date.now(),
      v: 1,
    }),
  };
}

function getMockGuests(): Guest[] {
  const names = [
    "Arjun Sharma",
    "Priya Patel",
    "Rahul Verma",
    "Ananya Singh",
    "Vikram Kapoor",
    "Neha Gupta",
    "Rohan Malhotra",
    "Kavya Reddy",
    "Aditya Kumar",
    "Ishita Joshi",
    "Karan Mehta",
    "Pooja Nair",
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
      id: `guest_${i}`,
      name,
      ticketType: ticket.name,
      entryType: ticket.entryType,
      quantity: ticket.entryType === "couple" ? 2 : 1,
      source: Math.random() > 0.75 ? ("door" as const) : ("online" as const),
      status: entered ? ("entered" as const) : ("not_entered" as const),
      enteredAt: entered ? new Date(Date.now() - Math.random() * 3600000).toISOString() : undefined,
    };
  });
}
