import { NextRequest, NextResponse } from "next/server";
import { getFirebaseDb } from "@/lib/firebase/client";
import { collection, addDoc, getDocs, query, where, Timestamp } from "firebase/firestore";

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const clubId = searchParams.get("clubId");
        const startDate = searchParams.get("startDate");
        const endDate = searchParams.get("endDate");

        if (!clubId) {
            return NextResponse.json({ error: "clubId is required" }, { status: 400 });
        }

        const db = getFirebaseDb();
        const eventsRef = collection(db, "venues", clubId, "calendar_events");

        let q = query(eventsRef);

        // Filter by date range if provided
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            q = query(
                eventsRef,
                where("date", ">=", Timestamp.fromDate(start)),
                where("date", "<=", Timestamp.fromDate(end))
            );
        }

        const snapshot = await getDocs(q);
        const events = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
            // Convert Firestore Timestamp to ISO string
            date: doc.data().date?.toDate?.()?.toISOString() || doc.data().date,
        }));

        return NextResponse.json({ events });

    } catch (error: any) {
        console.error("Error fetching calendar events:", error);
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const { clubId, date, type, title, reason, notes, hostName, status } = await req.json();

        if (!clubId || !date || !type) {
            return NextResponse.json(
                { error: "Missing required fields: clubId, date, type" },
                { status: 400 }
            );
        }

        const db = getFirebaseDb();
        const eventsRef = collection(db, "venues", clubId, "calendar_events");

        // Check if date is already blocked or has conflicting event
        const dateObj = new Date(date);
        const startOfDay = new Date(dateObj);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(dateObj);
        endOfDay.setHours(23, 59, 59, 999);

        const existingQuery = query(
            eventsRef,
            where("date", ">=", Timestamp.fromDate(startOfDay)),
            where("date", "<=", Timestamp.fromDate(endOfDay)),
            where("status", "!=", "cancelled")
        );

        const existing = await getDocs(existingQuery);

        if (!existing.empty && type === "blocked") {
            // Check if it's already blocked or has confirmed events
            const hasConflict = existing.docs.some(doc => {
                const eventType = doc.data().type;
                return eventType === "blocked" || eventType === "club-hosted" || eventType === "private";
            });

            if (hasConflict) {
                return NextResponse.json(
                    { error: "This date already has events or is blocked" },
                    { status: 409 }
                );
            }
        }

        // Create event
        const eventData = {
            date: Timestamp.fromDate(dateObj),
            type,
            title: title || (type === "blocked" ? `Blocked: ${reason}` : "Untitled Event"),
            reason: reason || null,
            notes: notes || null,
            hostName: hostName || null,
            status: status || "confirmed",
            createdAt: Timestamp.now(),
            clubId,
        };

        const docRef = await addDoc(eventsRef, eventData);

        return NextResponse.json({
            success: true,
            eventId: docRef.id,
            message: type === "blocked" ? "Date blocked successfully" : "Event created successfully",
        });

    } catch (error: any) {
        console.error("Error creating calendar event:", error);
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}
