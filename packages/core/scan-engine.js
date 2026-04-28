/**
 * THE C1RCLE - Master Scan Engine
 * Centralizes QR verification, device validation, and entry logging.
 */

import { createHmac } from "node:crypto";
import { getQrSecret } from "./secret-registry.js";

let _QR_SECRET = null;
function QR_SECRET() {
    if (!_QR_SECRET) _QR_SECRET = getQrSecret();
    return _QR_SECRET;
}

/**
 * Verifies the signature of a ticket QR code.
 */
export function verifyScanSignature(payload) {
    if (!payload.sig) return false;

    const isRSVP = payload.rt === 1;

    // Standard data format: orderId:eventId:ticketId:userId:quantity:timestamp:STATUS
    // Matches qrStore.js implementation
    const dataToSign = `${payload.o}:${payload.e}:${payload.t}:${payload.u}:${payload.q}:${payload.ts}:${isRSVP ? 'RSVP' : 'PAID'}`;
    const expectedSignature = createHmac("sha256", QR_SECRET())
        .update(dataToSign)
        .digest("hex")
        .substring(0, 16);

    return payload.sig === expectedSignature;
}

/**
 * Validates if a device is authorized to scan for a specific venue.
 */
export async function validateScannerDevice(db, deviceId, venueId) {
    const deviceRef = db.collection("bound_devices").doc(`${venueId}_${deviceId}`);
    const deviceDoc = await deviceRef.get();

    if (!deviceDoc.exists) {
        return { valid: false, error: "Device not authorized for this venue" };
    }

    const device = deviceDoc.data() || {};
    if (device.status !== "active" || device.bound !== true) {
        return { valid: false, error: "Device not authorized for this venue" };
    }

    return {
        valid: true,
        device: { id: deviceDoc.id, ...device },
        ref: deviceRef
    };
}

/**
 * Records a scan attempt (success or failure).
 */
export async function recordScanAttempt(db, data) {
    const now = new Date().toISOString();
    return db.collection("ticket_scans").add({
        ...data,
        scannedAt: now,
        createdAt: now
    });
}

export default {
    verifyScanSignature,
    validateScannerDevice,
    recordScanAttempt
};
