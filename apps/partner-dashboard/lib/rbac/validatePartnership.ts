/**
 * RBAC — Partnership Validation
 *
 * Conceptual middleware for validating that an agent (host or promoter)
 * holds an approved partnership with a venue before granting access to
 * protected resources:
 *   - Venue secret calendar
 *   - Event draft creation at a venue
 *   - Affiliate tracking link generation
 *
 * Usage example (in a Next.js API route or server action):
 *
 *   const result = await validatePartnership(hostId, venueId);
 *   if (!result.valid) return NextResponse.json({ error: result.reason }, { status: 403 });
 */

import { getAdminDb } from "@/lib/firebase/admin";

interface ValidationResult {
    valid: boolean;
    reason?: string;
}

/**
 * Validates that `agentId` has an active partnership with `venueId`.
 *
 * @param agentId    - Firestore ID of the host or promoter partner
 * @param venueId    - Firestore ID of the venue partner
 */
export async function validatePartnership(
    agentId: string,
    venueId: string
): Promise<ValidationResult> {
    if (!agentId || !venueId) {
        return { valid: false, reason: "Missing agentId or venueId" };
    }

    const db = getAdminDb();

    // Check host-venue partnerships collection (field is hostId, status is "active" after approval)
    const partnershipSnap = await db
        .collection("partnerships")
        .where("hostId", "==", agentId)
        .where("venueId", "==", venueId)
        .where("status", "==", "active")
        .limit(1)
        .get();

    // Also check promoter connections collection
    const connectionSnap = await db
        .collection("promoter_connections")
        .where("promoterId", "==", agentId)
        .where("venueId", "==", venueId)
        .where("status", "==", "active")
        .limit(1)
        .get();

    const doc = partnershipSnap.docs[0] ?? connectionSnap.docs[0];

    if (!doc) {
        return {
            valid: false,
            reason: "No approved partnership found. Request access from the venue first.",
        };
    }

    return { valid: true };
}

/**
 * Example: Guard calendar access in an API route
 *
 * export async function GET(req: Request) {
 *   const { hostId, venueId } = parseParams(req);
 *   const { valid, reason } = await validatePartnership(hostId, venueId);
 *   if (!valid) return NextResponse.json({ error: reason }, { status: 403 });
 *   // ... return calendar data
 * }
 */
