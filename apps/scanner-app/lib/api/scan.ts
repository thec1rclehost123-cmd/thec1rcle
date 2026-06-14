import { apiClient } from "./client";

export async function processQRScan(request: ScanRequest): Promise<ScanResponse> {
  try {
    const data = await apiClient.processScan({
      qrData: request.qrData,
      eventId: request.eventId,
      eventCode: request.eventCode,
      gate: request.gate,
      scannedBy: {
        uid: `scanner_${request.eventCode}`,
        name: "Scanner",
        role: "door_staff",
      },
    });

    return {
      success: true,
      ...data,
    };
  } catch (error: any) {
    console.error("[processQRScan] Error:", error);

    if (error.status === 400 || error.status === 404 || error.status === 403) {
      return {
        success: false,
        result: error.data?.result || "invalid",
        error: error.message || "Scan failed",
        previousScan: error.data?.previousScan,
      };
    }

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
