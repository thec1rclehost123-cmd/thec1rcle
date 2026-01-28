
import { NextRequest, NextResponse } from "next/server";
import { verifyAuth, verifyPartnerAccess } from "@/lib/server/auth";
import { getAdminDb } from "@/lib/firebase/admin";
import { GeoPoint } from "firebase-admin/firestore";

// GET - Fetch venue settings
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");

        if (!venueId) {
            return NextResponse.json({ error: "venueId is required" }, { status: 400 });
        }

        // Verify access
        const canAccess = await verifyPartnerAccess(req, venueId);
        if (!canAccess) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const db = getAdminDb();
        if (!db) {
            return NextResponse.json({ error: "Database not available" }, { status: 503 });
        }

        const docSnap = await db.collection("venues").doc(venueId).get();
        if (!docSnap.exists) {
            return NextResponse.json({ error: "Venue not found" }, { status: 404 });
        }

        const data = docSnap.data() || {};

        // Return only relevant settings fields
        // We can return the whole doc or filter it. 
        // For settings page, we might need sensitive info like Bank details (if stored in same doc, usually in subcollection).
        // Let's return the main profile info first.

        const settings = {
            id: docSnap.id,
            name: data.name,
            displayName: data.displayName || data.name,
            email: data.email,
            phone: data.phone,
            website: data.website,
            timezone: data.timezone || "Asia/Kolkata",
            currency: data.currency || "INR",
            language: data.language || "en",

            // Location
            address: data.address,
            city: data.city,
            location: data.location, // String description e.g. "Koregaon Park"
            coordinates: data.coordinates ? {
                latitude: data.coordinates.latitude,
                longitude: data.coordinates.longitude
            } : null,

            // Tax/Fees
            gstRate: data.gstRate,
            feeStrategy: data.feeStrategy, // 'inclusive' or 'exclusive'

            // Payouts (if simple) - usually bank details are separate for security

            // Notifications
            notificationPreferences: data.notificationPreferences || {}
        };

        return NextResponse.json({ settings });

    } catch (error: any) {
        console.error("Error fetching venue settings:", error);
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}

// PATCH - Update venue settings
export async function PATCH(req: NextRequest) {
    try {
        const body = await req.json();
        const { venueId, updates } = body;

        if (!venueId || !updates) {
            return NextResponse.json({ error: "venueId and updates are required" }, { status: 400 });
        }

        // Verify access
        const canAccess = await verifyPartnerAccess(req, venueId);
        if (!canAccess) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const db = getAdminDb();
        if (!db) {
            return NextResponse.json({ error: "Database not available" }, { status: 503 });
        }

        const cleanUpdates: any = {
            updatedAt: new Date().toISOString()
        };

        // Whitelist allowed fields to prevent overwriting critical data like 'ownerId' or 'status'
        const allowedFields = [
            "name", "displayName", "email", "phone", "website",
            "timezone", "currency", "language",
            "address", "city", "location",
            "gstRate", "feeStrategy", "notificationPreferences"
        ];

        // Process allowed flat fields
        for (const field of allowedFields) {
            if (updates[field] !== undefined) {
                cleanUpdates[field] = updates[field];
            }
        }

        // Handle Coordinates specifically
        if (updates.coordinates) {
            const { latitude, longitude } = updates.coordinates;
            // Ensure valid numbers
            if (typeof latitude === 'number' && typeof longitude === 'number') {
                cleanUpdates.coordinates = new GeoPoint(latitude, longitude);
            }
        }

        // Handle bank details? Probably separate sensitive route.
        // Handle images? Usually handled by upload before here.

        await db.collection("venues").doc(venueId).update(cleanUpdates);

        return NextResponse.json({ success: true, updates: cleanUpdates });

    } catch (error: any) {
        console.error("Error updating venue settings:", error);
        return NextResponse.json(
            { error: error.message || "Internal server error" },
            { status: 500 }
        );
    }
}
