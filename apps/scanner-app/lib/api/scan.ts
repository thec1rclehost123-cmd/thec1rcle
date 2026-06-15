import { scannerFetch } from './client';
import { getActiveCode } from './eventCode';

export interface ScanRequest {
  qrData: string;
  eventId: string;
  eventCode: string;
  gate?: string;
}

export interface ScanResponse {
  success: boolean;
  result?: 'valid' | 'already_scanned' | 'invalid' | 'wrong_event' | 'not_confirmed';
  message?: string;
  ticket?: {
    orderId: string;
    eventId: string;
    userName: string;
    ticketName: string;
    quantity: number;
    entryType: string;
  };
  previousScan?: {
    time: string;
    by: string;
  };
  error?: string;
}

/**
 * Send a scanned QR payload to the backend for validation.
 * Maps the { status, ticket, message } response shape from the server
 * to the ScanResponse shape the scan screen consumes.
 */
export async function processQRScan(request: ScanRequest): Promise<ScanResponse> {
  const code = (await getActiveCode()) || request.eventCode;

  try {
    const data = await scannerFetch(
      '/api/scanner/scan',
      {
        method: 'POST',
        body: JSON.stringify({
          qrData: request.qrData,
          eventId: request.eventId,
        }),
      },
      code,
    );

    if (data.status === 'approved') {
      return {
        success: true,
        result: 'valid',
        message: data.message || 'Entry approved!',
        ticket: data.ticket
          ? {
              orderId: data.ticket.orderId || '',
              eventId: request.eventId,
              userName: data.ticket.userName || 'Guest',
              ticketName: data.ticket.ticketName || 'Entry',
              quantity: data.ticket.quantity || 1,
              entryType: data.ticket.entryType || 'general',
            }
          : undefined,
      };
    }

    // Denied — map reason to a result type the UI understands
    const reasonMap: Record<string, ScanResponse['result']> = {
      already_used: 'already_scanned',
      event_mismatch: 'wrong_event',
      order_not_confirmed: 'not_confirmed',
    };

    const prev = data.previousScan;
    return {
      success: false,
      result: reasonMap[data.reason] || 'invalid',
      error: data.message || 'Ticket denied',
      previousScan: prev
        ? { time: prev.scannedAt || prev.time || '', by: prev.scannedBy || prev.by || '' }
        : undefined,
    };
  } catch (error: any) {
    console.error('[processQRScan] Error:', error);

    if (error.status === 400 || error.status === 403 || error.status === 404) {
      const prev = error.data?.previousScan;
      return {
        success: false,
        result: 'invalid',
        error: error.data?.message || error.message || 'Scan failed',
        previousScan: prev
          ? { time: prev.scannedAt || prev.time || '', by: prev.scannedBy || prev.by || '' }
          : undefined,
      };
    }

    if (__DEV__) {
      return simulateScan(request.qrData);
    }

    throw new Error('Unable to connect to server');
  }
}

function simulateScan(qrData: string): ScanResponse {
  try {
    const parsed = JSON.parse(qrData);
    const random = Math.random();

    if (random < 0.7) {
      return {
        success: true,
        result: 'valid',
        message: 'Entry approved!',
        ticket: {
          orderId: parsed.o || 'demo_order',
          eventId: parsed.e || 'demo_event',
          userName: 'Demo Guest',
          ticketName: parsed.n || 'General Entry',
          quantity: parsed.q || 1,
          entryType: parsed.et || 'general',
        },
      };
    } else if (random < 0.85) {
      return {
        success: false,
        result: 'already_scanned',
        error: 'Ticket already scanned',
        previousScan: {
          time: new Date(Date.now() - 3600000).toLocaleTimeString(),
          by: 'Staff Member',
        },
      };
    } else {
      return { success: false, result: 'invalid', error: 'Invalid QR code' };
    }
  } catch {
    return { success: false, result: 'invalid', error: 'Could not parse QR code' };
  }
}
