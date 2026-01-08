import { verifyAuth } from "@/lib/server/auth";
import { getAdminDb } from "@/lib/firebase/admin";
import { generateEntitlementQR } from "@c1rcle/core/entitlement-engine";

export async function GET(request, { params }) {
    const user = await verifyAuth(request);
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const entitlementId = params.id;
    const db = getAdminDb();
    const entDoc = await db.collection("entitlements").doc(entitlementId).get();

    if (!entDoc.exists) return Response.json({ error: "Not Found" }, { status: 404 });
    const entitlement = entDoc.data();

    // Only owner can get the rotating QR
    if (entitlement.ownerUserId !== user.uid) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const qr = generateEntitlementQR(entitlementId);

    // Convert to JSON string for the client to scan
    const rawData = JSON.stringify(qr);

    return Response.json({
        ...qr,
        rawData
    });
}
