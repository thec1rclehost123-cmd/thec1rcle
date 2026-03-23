import { NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebase/admin";
import { verifyAuth } from "@/lib/server/auth";
import { FieldValue } from "firebase-admin/firestore";

/**
 * POST /api/setup/provision-venue
 * Dev-only bootstrap: sets Firebase custom claims and Firestore data so the
 * currently logged-in user can access the venue dashboard.
 *
 * Only active in development. Returns 404 in production.
 */
export async function POST(req) {
    if (process.env.NODE_ENV !== "development") {
        return NextResponse.json({ error: "Not Found" }, { status: 404 });
    }

    try {
        // In dev, accept uid from body (no token extraction needed in browser console)
        let uid;
        let bodyUid;
        try {
            const body = await req.clone().json();
            bodyUid = body?.uid;
        } catch (_) {}

        if (bodyUid) {
            uid = bodyUid;
        } else {
            const decodedToken = await verifyAuth(req);
            if (!decodedToken) {
                return NextResponse.json({ error: "Unauthorized — pass { uid } in body or include Authorization header" }, { status: 401 });
            }
            uid = decodedToken.uid;
        }
        const db = getAdminDb();
        const auth = getAdminAuth();

        // 1. Find or create a dev venue document for this user
        const venuesSnap = await db.collection("venues")
            .where("ownerId", "==", uid)
            .limit(1)
            .get();

        let venueId;
        let venueName;

        if (!venuesSnap.empty) {
            venueId = venuesSnap.docs[0].id;
            venueName = venuesSnap.docs[0].data().name || "Dev Venue";
        } else {
            // Create a dev venue
            const venueRef = db.collection("venues").doc();
            venueId = venueRef.id;
            venueName = "Dev Venue";
            await venueRef.set({
                id: venueId,
                name: venueName,
                ownerId: uid,
                type: "venue",
                city: "Pune",
                isApproved: true,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });
        }

        // 2. Set Firebase custom claims
        const claims = {
            partnerId: venueId,
            partnerType: "venue",
            partnerRole: "owner",
        };
        await auth.setCustomUserClaims(uid, claims);

        // 3. Update the user's Firestore doc with approved status and activeMembership
        await db.collection("users").doc(uid).set(
            {
                isApproved: true,
                role: "venue",
                activeMembership: {
                    partnerId: venueId,
                    partnerType: "venue",
                    partnerName: venueName,
                    role: "owner",
                    joinedAt: Date.now(),
                    isActive: true,
                },
                updatedAt: FieldValue.serverTimestamp(),
            },
            { merge: true }
        );

        return NextResponse.json({ success: true, uid, venueId, venueName, claims });
    } catch (error) {
        console.error("[Setup] provision-venue Error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
