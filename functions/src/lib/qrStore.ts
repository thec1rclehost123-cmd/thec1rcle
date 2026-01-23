/**
 * QR Code Store
 * Generates and validates QR codes for tickets
 */

import { createHmac } from "node:crypto";

// Secret key for HMAC signing (should be in env vars in production)
const QR_SECRET = process.env.QR_SECRET_KEY || "c1rcle-qr-secret-2024";

interface QRPayloadParams {
    orderId: string;
    eventId: string;
    ticketId: string;
    ticketTierName: string;
    userId: string;
    quantity?: number;
    entryType?: string;
    isRSVP?: boolean;
}

/**
 * Generate QR code payload for a ticket
 * The QR code contains a signed JSON payload that can be verified at entry
 */
export function generateQRPayload({
    orderId,
    eventId,
    ticketId,
    ticketTierName,
    userId,
    quantity = 1,
    entryType = "general",
    isRSVP = false
}: QRPayloadParams) {
    const timestamp = Date.now();

    // Create the payload
    const payload: any = {
        o: orderId,           // Order ID
        e: eventId,           // Event ID
        t: ticketId,          // Ticket tier ID
        n: ticketTierName,    // Ticket name (for display)
        u: userId,            // User ID
        q: quantity,          // Quantity
        et: entryType,        // Entry type (stag, couple, etc.)
        rt: isRSVP ? 1 : 0,    // RSVP Type (1 = RSVP, 0 = Paid)
        ts: timestamp,        // Timestamp
        v: 1                  // Version for future compatibility
    };

    // Create signature
    const dataToSign = `${orderId}:${eventId}:${ticketId}:${userId}:${quantity}:${timestamp}:${isRSVP ? 'RSVP' : 'PAID'}`;
    const signature = createHmac("sha256", QR_SECRET)
        .update(dataToSign)
        .digest("hex")
        .substring(0, 16); // Shortened for QR efficiency

    payload.sig = signature;

    return payload;
}

/**
 * Generate QR code data URL
 * Returns a base64 encoded SVG that can be displayed directly
 */
export function generateQRCodeData(payload: any) {
    // Convert payload to compact JSON string
    const data = JSON.stringify(payload);

    // For server-side QR generation, we'll return the raw data
    // The client will use a QR library to render it
    return {
        rawData: data,
        // Shortened URL format for compact QR
        shortData: `c1r://${payload.o}/${payload.sig}`
    };
}

/**
 * Verify a QR code payload
 * Returns verification result with decoded data
 */
export function verifyQRPayload(payload: any) {
    try {
        // Validate required fields
        if (!payload.o || !payload.e || !payload.t || !payload.sig) {
            return { valid: false, error: "Invalid QR code format" };
        }

        const isRSVP = payload.rt === 1;

        // Recreate the signature
        const dataToSign = `${payload.o}:${payload.e}:${payload.t}:${payload.u}:${payload.q}:${payload.ts}:${isRSVP ? 'RSVP' : 'PAID'}`;
        const expectedSignature = createHmac("sha256", QR_SECRET)
            .update(dataToSign)
            .digest("hex")
            .substring(0, 16);

        if (payload.sig !== expectedSignature) {
            return { valid: false, error: "Invalid signature - QR code may be tampered" };
        }

        // Check if QR is too old (older than 48 hours before event)
        // This is a soft check - the actual validation happens at scan time
        const qrAge = Date.now() - payload.ts;
        const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days
        if (qrAge > maxAge) {
            return { valid: false, error: "QR code has expired" };
        }

        return {
            valid: true,
            data: {
                orderId: payload.o,
                eventId: payload.e,
                ticketId: payload.t,
                ticketName: payload.n,
                userId: payload.u,
                quantity: payload.q,
                entryType: payload.et,
                isRSVP: isRSVP,
                generatedAt: new Date(payload.ts).toISOString(),
                version: payload.v
            }
        };
    } catch (error) {
        return { valid: false, error: "Failed to parse QR code" };
    }
}

/**
 * Parse QR code from scan
 * Handles both full JSON and short URL format
 */
export function parseQRCode(scanData: string) {
    try {
        // Try parsing as JSON first
        if (scanData.startsWith("{")) {
            return JSON.parse(scanData);
        }

        // Handle short URL format: c1r://orderId/signature
        if (scanData.startsWith("c1r://")) {
            const parts = scanData.replace("c1r://", "").split("/");
            if (parts.length >= 2) {
                return {
                    o: parts[0],
                    sig: parts[1],
                    isShort: true
                };
            }
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * Generate all QR codes for an order
 * Returns an array of QR payloads, one per ticket in the order
 */
export function generateOrderQRCodes(order: any, event: any) {
    const qrCodes = [];
    const isRSVP = event?.isRSVP || order.isRSVP || order.id.startsWith("RSVP");

    for (const ticket of order.tickets) {
        // Generate one QR per quantity unit if needed
        // For simplicity, we generate one QR per ticket tier with quantity
        const payload = generateQRPayload({
            orderId: order.id,
            eventId: order.eventId,
            ticketId: ticket.ticketId,
            ticketTierName: ticket.name,
            userId: order.userId,
            quantity: ticket.quantity,
            entryType: ticket.entryType || "general",
            isRSVP: isRSVP
        });

        const qrData = generateQRCodeData(payload);

        qrCodes.push({
            ticketId: ticket.ticketId,
            ticketName: ticket.name,
            quantity: ticket.quantity,
            entryType: ticket.entryType || "general",
            isRSVP: isRSVP,
            qrPayload: payload,
            qrCode: qrData.rawData, // Change from qrData to qrCode to match app expectation
            shortCode: qrData.shortData
        });
    }

    return qrCodes;
}
