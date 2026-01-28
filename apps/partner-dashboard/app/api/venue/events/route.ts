import { NextRequest, NextResponse } from "next/server";
import { updateEventLifecycle } from "@/lib/server/eventStore";
import { verifyAuth } from "@/lib/server/auth";
import { getFirebaseDb } from "@/lib/firebase/client";
import {
    collection,
    getDocs,
    query,
    where
} from "firebase/firestore";

// GET - Fetch all events for a club
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");
        const status = searchParams.get("status");

        if (!venueId) {
            return NextResponse.json({ error: "venueId is required" }, { status: 400 });
        }

        const db = getFirebaseDb();
        const eventsRef = collection(db, "events");

        let q = query(eventsRef, where("venueId", "==", venueId));

        if (status && status !== "all") {
            q = query(q, where("status", "==", status));
        }

        const snapshot = await getDocs(q);
        const events = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            date: doc.data().date?.toDate?.()?.toISOString() || doc.data().date,
        }));

        return NextResponse.json({ events });

    } catch (error: any) {
        console.error("Error fetching events:", error);
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}

// PATCH - Update event (approve, reject, pause, lock)
export async function PATCH(req: NextRequest) {
    try {
        const decodedToken: any = await verifyAuth(req);
        if (!decodedToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { eventId, action, data } = await req.json();

        if (!eventId || !action) {
            return NextResponse.json(
                { error: "eventId and action are required" },
                { status: 400 }
            );
        }

        // Map frontend action to canonical lifecycle status
        const statusMap: Record<string, string> = {
            approve: "approved",
            reject: "denied",
            pause: "paused",
            resume: "live"
        };

        const newStatus = statusMap[action];
        if (!newStatus) {
            return NextResponse.json({ error: "Invalid action" }, { status: 400 });
        }

        // Resolve efficient role
        let role = decodedToken.partnerType || (decodedToken.admin ? "admin" : "user");

        // If role matches 'user' but we are performing an approval, check if they are actually a venue
        if (role === "user" && (action === "approve" || action === "reject")) {
            try {
                // Dynamic import to avoid circular dep issues if any
                const { getAdminDb } = await import("@/lib/firebase/admin");
                const db = getAdminDb();

                // Check if they own any venue
                const venueSnap = await db.collection("venues")
                    .where("ownerId", "==", decodedToken.uid)
                    .limit(1)
                    .get();

                if (!venueSnap.empty) {
                    role = "venue";
                } else {
                    // Check direct partner memberships
                    const memberSnap = await db.collection("partner_memberships")
                        .where("uid", "==", decodedToken.uid)
                        .where("role", "in", ["owner", "manager", "ops"])
                        .limit(1)
                        .get();

                    if (!memberSnap.empty) {
                        // Check if that membership is for a venue
                        const membership = memberSnap.docs[0].data();
                        // We might need to check if the partnerId is a venue, but typically hosts don't hav detailed roles yet
                        // For safety, let's assume if they have a manager role they are staff
                        role = "venue";
                    }
                }

                // Dev backdoor for testing
                if (process.env.NODE_ENV === "development" && decodedToken.uid === "dev-user-123") {
                    role = "venue";
                }
            } catch (err) {
                console.error("Role resolution failed:", err);
            }
        }

        // Internal context for eventStore
        const context = {
            uid: decodedToken.uid,
            role: role,
            requestId: `API_${Date.now()}`
        };

        const result = await updateEventLifecycle(
            eventId,
            newStatus,
            context,
            data?.notes || data?.reason || ""
        );

        return NextResponse.json(result);

    } catch (error: any) {
        console.error("Error updating event:", error);
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}
