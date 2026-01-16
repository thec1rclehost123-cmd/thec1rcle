/**
 * THE C1RCLE - Venue Device API
 * Manage bound scanner devices
 */

import { NextRequest, NextResponse } from "next/server";
import { getAdminDb, isFirebaseConfigured } from "@/lib/firebase/admin";
import { verifyAuth } from "@/lib/server/auth";
import { bindDevice, getVenueDevices, revokeDevice } from "@/lib/server/staffService";

const BOUND_DEVICES_COLLECTION = "bound_devices";

/**
 * GET /api/venue/devices
 * List all devices for a club
 */
export async function GET(request: NextRequest) {
    try {
        const auth = await verifyAuth(request);
        if (!auth) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const venueId = searchParams.get("venueId");

        if (!venueId) {
            return NextResponse.json({ error: "venueId is required" }, { status: 400 });
        }

        const devices = await getVenueDevices(venueId);

        return NextResponse.json({ devices });
    } catch (error: any) {
        console.error("[Venue Devices API] GET Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch devices" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/venue/devices
 * Bind a new device
 */
export async function POST(request: NextRequest) {
    try {
        const auth = await verifyAuth(request);
        if (!auth) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { venueId, deviceId, name, staffId } = body;

        if (!venueId || !deviceId || !name) {
            return NextResponse.json(
                { error: "venueId, deviceId, and name are required" },
                { status: 400 }
            );
        }

        const result = await bindDevice(
            venueId,
            { deviceId, name },
            staffId || null,
            { uid: auth.uid, name: auth.name || auth.email }
        );

        if (!result.success) {
            return NextResponse.json({ error: result.error }, { status: 400 });
        }

        return NextResponse.json({
            success: true,
            device: result.device
        }, { status: 201 });
    } catch (error: any) {
        console.error("[Venue Devices API] POST Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to bind device" },
            { status: 500 }
        );
    }
}

/**
 * DELETE /api/venue/devices
 * Revoke a device
 */
export async function DELETE(request: NextRequest) {
    try {
        const auth = await verifyAuth(request);
        if (!auth) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const deviceId = searchParams.get("deviceId");

        if (!deviceId) {
            return NextResponse.json({ error: "deviceId is required" }, { status: 400 });
        }

        const result = await revokeDevice(
            deviceId,
            { uid: auth.uid, name: auth.name || auth.email }
        );

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error("[Venue Devices API] DELETE Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to revoke device" },
            { status: 500 }
        );
    }
}
