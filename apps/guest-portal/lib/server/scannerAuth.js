import { getAdminDb, isFirebaseConfigured } from "../firebase/admin.js";

/**
 * Validates the X-Scanner-Code header against the scanner_sessions Firestore collection.
 * Returns the session doc or throws a Response with 401/403.
 *
 * @param {Request} request
 * @returns {{ code, eventId, venueId, canScan, canDoorEntry, gate }}
 */
export async function validateScannerCode(request) {
    const code = request.headers.get("x-scanner-code");
    if (!code) {
        throw new ScannerAuthError("Missing scanner code", 401);
    }

    if (!isFirebaseConfigured()) {
        // Dev fallback — accept any non-empty code
        return {
            code,
            eventId: "dev_event",
            venueId: "dev_venue",
            canScan: true,
            canDoorEntry: true,
            gate: "Main Gate",
        };
    }

    const db = getAdminDb();
    const snap = await db.collection("scanner_sessions").doc(code).get();

    if (!snap.exists) {
        throw new ScannerAuthError("Invalid scanner code", 401);
    }

    const session = snap.data();

    const expiresAt = session.expiresAt?.toDate?.() || new Date(session.expiresAt);
    if (expiresAt < new Date()) {
        throw new ScannerAuthError("Scanner code has expired", 401);
    }

    return {
        code,
        eventId: session.eventId,
        venueId: session.venueId,
        canScan: session.canScan ?? true,
        canDoorEntry: session.canDoorEntry ?? false,
        gate: session.gate || "Main Gate",
    };
}

export class ScannerAuthError extends Error {
    constructor(message, status = 401) {
        super(message);
        this.status = status;
    }
}
