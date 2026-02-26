/**
 * THE C1RCLE - Master Scan Engine
 * Centralizes QR verification, device validation, and entry logging.
 */

import { createHmac } from "node:crypto";

const QR_SECRET = process.env.QR_SECRET_KEY || "c1rcle-qr-secret-2024";

/**
 * Verifies the signature of a ticket QR code.
 */
export function verifyScanSignature(payload) {
    if (!payload.sig) return false;

    // Standard data format: orderId:eventId:ticketId:userId:quantity:timestamp
    const dataToSign = `${payload.o}:${payload.e}:${payload.t}:${payload.u}:${payload.q}:${payload.ts}`;
    const expectedSignature = createHmac("sha256", QR_SECRET)
        .update(dataToSign)
        .digest("hex")
        .substring(0, 16);

    return payload.sig === expectedSignature;
}

/**
 * Validates if a device is authorized to scan for a specific venue.
 */
export async function validateScannerDevice(db, deviceId, venueId) {
    const snapshot = await db.collection("bound_devices")
        .where("deviceId", "==", deviceId)
        .where("venueId", "==", venueId)
        .where("status", "==", "active")
        .limit(1)
        .get();

    if (snapshot.empty) {
        return { valid: false, error: "Device not authorized for this venue" };
    }

    const deviceDoc = snapshot.docs[0];
    return {
        valid: true,
        device: { id: deviceDoc.id, ...deviceDoc.data() },
        ref: deviceDoc.ref
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
