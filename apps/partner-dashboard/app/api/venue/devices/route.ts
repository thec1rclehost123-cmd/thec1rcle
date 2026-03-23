/**
 * THE C1RCLE - Venue Device API
 * Manage bound scanner devices
 */

import { NextRequest } from "next/server";
import { bindDevice, getVenueDevices, revokeDevice } from "@/lib/server/staffService";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";

/**
 * GET /api/venue/devices
 * List all devices for a club
 */
export const GET = withAuth(async (req: NextRequest, auth) => {
    try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");
        if (!venueId) return fail("venueId is required", 400);

        const devices = await getVenueDevices(venueId);
        return ok({ devices });
    } catch (error: any) {
        console.error("[Venue Devices API] GET Error:", error);
        return fail("Failed to fetch devices");
    }
});

/**
 * POST /api/venue/devices
 * Bind a new device
 */
export const POST = withAuth(async (req: NextRequest, auth) => {
    try {
        const body = await req.json();
        const { venueId, deviceId, name, staffId } = body;

        if (!venueId || !deviceId || !name) return fail("venueId, deviceId, and name are required", 400);

        const result = await bindDevice(
            venueId,
            { deviceId, name },
            staffId || null,
            { uid: auth.uid, name: auth.name || auth.email }
        );

        if (!result.success) return fail(result.error || "Failed to bind device", 400);

        return ok({ device: result.device }, "Device bound", 201);
    } catch (error: any) {
        console.error("[Venue Devices API] POST Error:", error);
        return fail("Failed to bind device");
    }
});

/**
 * DELETE /api/venue/devices
 * Revoke a device
 */
export const DELETE = withAuth(async (req: NextRequest, auth) => {
    try {
        const { searchParams } = new URL(req.url);
        const deviceId = searchParams.get("deviceId");
        if (!deviceId) return fail("deviceId is required", 400);

        await revokeDevice(deviceId, { uid: auth.uid, name: auth.name || auth.email });
        return ok({ success: true }, "Device revoked");
    } catch (error: any) {
        console.error("[Venue Devices API] DELETE Error:", error);
        return fail("Failed to revoke device");
    }
});
