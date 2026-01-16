const API_BASE = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3001/api";

interface ScanRequest {
    qrData: string;
    eventId: string;
    eventCode: string;
    gate?: string;
}

interface ScanResponse {
    success: boolean;
    result?: string;
    scanId?: string;
    error?: string;
    message?: string;
    ticket?: {
        orderId: string;
        eventId: string;
        eventTitle: string;
        ticketName: string;
        quantity: number;
        entryType: string;
        userName: string;
        userEmail: string;
    };
    previousScan?: {
        scannedAt: string;
        scannedBy: {
            name: string;
            role: string;
        };
    };
}

/**
 * Process a QR code scan
 */
export async function processQRScan(request: ScanRequest): Promise<ScanResponse> {
    try {
        const response = await fetch(`${API_BASE}/scan`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
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

        return {
            success: true,
            ...data,
        };
    } catch (error: any) {
        console.error("[processQRScan] Error:", error);

        // For development, simulate scan results
        if (__DEV__) {
            return simulateScan(request.qrData);
        }

        throw new Error("Unable to connect to server");
    }
}

/**
 * Simulate scan for development
 */
function simulateScan(qrData: string): ScanResponse {
    // Parse mock QR data
    try {
        const parsed = JSON.parse(qrData);

        // Random result for testing
        const random = Math.random();

        if (random < 0.7) {
            // Valid scan
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
        } else if (random < 0.85) {
            // Already scanned
            return {
                success: false,
                result: "already_scanned",
                error: "Ticket already scanned",
                previousScan: {
                    scannedAt: new Date(Date.now() - 3600000).toLocaleTimeString(),
                    scannedBy: {
                        name: "Staff Member",
                        role: "security",
                    },
                },
            };
        } else {
            // Invalid
            return {
                success: false,
                result: "invalid",
                error: "Invalid QR code",
            };
        }
    } catch {
        return {
            success: false,
            result: "invalid",
            error: "Could not parse QR code",
        };
    }
}
