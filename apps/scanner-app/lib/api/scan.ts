import { scannerFetch } from './client';
import { getActiveCode } from './eventCode';
import { getOrCreateScannerDeviceId } from '../deviceIdentity';

export interface ScanRequest {
  qrData: string;
  eventId: string;
  eventCode: string;
  venueId: string;
  gate?: string;
}

export interface ScanResponse {
  success: boolean;
  result?:
    | 'valid'
    | 'already_scanned'
    | 'invalid'
    | 'wrong_event'
    | 'not_confirmed'
    | 'revoked'
    | 'expired'
    | 'device_invalid'
    | 'confirmation_required';
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
  requiresConfirmation?: boolean;
  confirmationToken?: string;
}

/**
 * Send a scanned QR payload to the backend for validation.
 * Maps the { status, ticket, message } response shape from the server
 * to the ScanResponse shape the scan screen consumes.
 */
export async function processQRScan(request: ScanRequest): Promise<ScanResponse> {
  const code = (await getActiveCode()) || request.eventCode;
  const deviceId = await getOrCreateScannerDeviceId();
  const reasonMap: Record<string, ScanResponse['result']> = {
    already_used: 'already_scanned',
    event_mismatch: 'wrong_event',
    order_not_confirmed: 'not_confirmed',
    wrong_event: 'wrong_event',
    already_scanned: 'already_scanned',
    revoked: 'revoked',
    expired: 'expired',
    device_invalid: 'device_invalid',
    confirmation_required: 'confirmation_required',
  };

  try {
    const data = await scannerFetch('/scan', {
      method: 'POST',
      body: JSON.stringify({
        qrData: request.qrData,
        eventId: request.eventId,
        eventCode: code,
        venueId: request.venueId,
        deviceId,
        gate: request.gate,
      }),
    });

    if (data.success === true) {
      return {
        success: true,
        result: data.result || 'valid',
        message: data.message || 'Entry approved!',
        requiresConfirmation: data.requiresConfirmation === true,
        confirmationToken: data.confirmationToken,
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
    const prev = data.previousScan;
    return {
      success: false,
      result: data.result || reasonMap[data.reason] || 'invalid',
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
        result:
          error.data?.result ||
          reasonMap[error.data?.reason] ||
          (error.status === 403 ? 'device_invalid' : 'invalid'),
        error: error.data?.message || error.message || 'Scan failed',
        previousScan: prev
          ? { time: prev.scannedAt || prev.time || '', by: prev.scannedBy || prev.by || '' }
          : undefined,
      };
    }

    throw new Error('Scanner is offline. Entry is denied until connectivity is restored.');
  }
}

export async function confirmCoupleScan(
  confirmationToken: string,
  request: Omit<ScanRequest, 'qrData'>,
): Promise<ScanResponse> {
  const deviceId = await getOrCreateScannerDeviceId();
  const data = await scannerFetch('/scan/confirm-couple', {
    method: 'POST',
    body: JSON.stringify({
      confirmationToken,
      eventId: request.eventId,
      eventCode: request.eventCode,
      venueId: request.venueId,
      deviceId,
      gate: request.gate,
    }),
  });
  return data as ScanResponse;
}

/**
 * Refresh event stats.
 */
export async function refreshEventStats(eventId: string, code?: string): Promise<any> {
  try {
    const data = await scannerFetch(
      `/scan/stats?eventId=${encodeURIComponent(eventId)}${code ? `&code=${encodeURIComponent(code)}` : ''}`,
      {},
    );
    return data.stats || data;
  } catch (error) {
    console.error('[refreshEventStats] Error:', error);
    return null;
  }
}
