import { NextRequest, NextResponse } from "next/server";
import { getFirebaseDb } from "@/lib/firebase/client";
import {
    collection,
    doc,
    getDocs,
    getDoc,
    updateDoc,
    query,
    where,
    Timestamp,
    addDoc
} from "firebase/firestore";

// GET - Fetch all events for a club
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const clubId = searchParams.get("clubId");
        const status = searchParams.get("status");

        if (!clubId) {
            return NextResponse.json({ error: "clubId is required" }, { status: 400 });
        }

        const db = getFirebaseDb();
        const eventsRef = collection(db, "events");

        let q = query(eventsRef, where("venueId", "==", clubId));

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
        const { eventId, action, data } = await req.json();

        if (!eventId || !action) {
            return NextResponse.json(
                { error: "eventId and action are required" },
                { status: 400 }
            );
        }

        const db = getFirebaseDb();
        const eventRef = doc(db, "events", eventId);
        const eventSnap = await getDoc(eventRef);

        if (!eventSnap.exists()) {
            return NextResponse.json({ error: "Event not found" }, { status: 404 });
        }

        const event = eventSnap.data();
        let updateData: any = {};
        let logEntry: any = {
            eventId,
            action,
            timestamp: Timestamp.now(),
            ...data,
        };

        switch (action) {
            case "approve":
                if (event.status !== "pending") {
                    return NextResponse.json(
                        { error: "Only pending events can be approved" },
                        { status: 400 }
                    );
                }
                updateData = {
                    status: "active",
                    lifecycle: "approved",
                    approvedAt: Timestamp.now(),
                    approvalNotes: data?.notes || null,
                };
                break;

            case "reject":
                if (event.status !== "pending") {
                    return NextResponse.json(
                        { error: "Only pending events can be rejected" },
                        { status: 400 }
                    );
                }
                updateData = {
                    status: "cancelled",
                    lifecycle: "cancelled",
                    rejectedAt: Timestamp.now(),
                    rejectionNotes: data?.notes || null,
                };
                break;

            case "pause":
                if (event.status !== "live") {
                    return NextResponse.json(
                        { error: "Only live events can be paused" },
                        { status: 400 }
                    );
                }
                updateData = {
                    status: "paused",
                    pausedAt: Timestamp.now(),
                    pauseReason: data?.reason || "Emergency pause by club",
                };
                break;

            case "resume":
                if (event.status !== "paused") {
                    return NextResponse.json(
                        { error: "Only paused events can be resumed" },
                        { status: 400 }
                    );
                }
                updateData = {
                    status: "live",
                    resumedAt: Timestamp.now(),
                };
                break;

            case "lock":
                if (event.status !== "completed") {
                    return NextResponse.json(
                        { error: "Only completed events can be locked" },
                        { status: 400 }
                    );
                }
                updateData = {
                    status: "locked",
                    lockedAt: Timestamp.now(),
                    hostRating: data?.rating || null,
                    internalFeedback: data?.feedback || null,
                };
                break;

            default:
                return NextResponse.json(
                    { error: "Invalid action" },
                    { status: 400 }
                );
        }

        // Update event
        await updateDoc(eventRef, updateData);

        // Log action
        const logsRef = collection(db, "events", eventId, "action_logs");
        await addDoc(logsRef, logEntry);

        return NextResponse.json({
            success: true,
            message: `Event ${action}ed successfully`,
        });

    } catch (error: any) {
        console.error("Error updating event:", error);
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}
