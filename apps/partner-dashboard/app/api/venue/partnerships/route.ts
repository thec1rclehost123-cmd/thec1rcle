import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { listPartnerships, approvePartnership, rejectPartnership } from "@/lib/server/partnershipStore";
import { ok, fail } from "@/lib/server/apiResponse";
import { requireVenueAccess } from "@/lib/rbac/staffProfileEnforcer";
import { requireHostAccess } from "@/lib/server/hostAuthMiddleware";
import { getAdminDb } from "@/lib/firebase/admin";

const PartnershipsQuery = z.object({
    venueId: z.string().optional(),
    hostId: z.string().optional(),
    status: z.string().optional(),
});

const UpdatePartnershipBody = z.object({
    partnershipId: z.string().min(1, "partnershipId is required"),
    action: z.enum(["approve", "reject"], { error: "action must be 'approve' or 'reject'" }),
});

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const parsed = PartnershipsQuery.safeParse(Object.fromEntries(searchParams));
        if (!parsed.success) return fail(parsed.error.issues[0].message, 400);

        const filters: Record<string, string> = {};
        if (parsed.data.venueId) {
            const ctx = await requireVenueAccess(req);
            if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
            filters.venueId = ctx.venueId;
        } else if (parsed.data.hostId) {
            const ctx = await requireHostAccess(req);
            if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
            filters.hostId = ctx.hostId;
        } else {
            return fail("venueId or hostId is required", 400);
        }
        if (parsed.data.status) filters.status = parsed.data.status;

        const partnerships = await listPartnerships(filters);
        return ok({ partnerships });
    } catch (error: any) {
        console.error("[GET /api/venue/partnerships]", error);
        return fail("Failed to fetch partnerships");
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const ctx = await requireVenueAccess(req, "events:edit");
        if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

        const rawBody = await req.json();
        const parsed = UpdatePartnershipBody.safeParse(rawBody);
        if (!parsed.success) return fail(parsed.error.issues[0].message, 400);

        const { partnershipId, action } = parsed.data;
        const db = getAdminDb();
        const partnershipDoc = await db.collection("partnerships").doc(partnershipId).get();
        if (!partnershipDoc.exists) return fail("Partnership not found", 404);

        const partnership = partnershipDoc.data() || {};
        if (partnership.venueId !== ctx.venueId) return fail("Forbidden", 403);
        if (partnership.status !== "pending") return fail("Partnership is no longer pending", 409);
        if (partnership.initiatedBy !== "host") return fail("Only incoming host requests can be updated here", 409);

        if (action === "approve") {
            await approvePartnership(partnershipId);
        } else {
            await rejectPartnership(partnershipId);
        }

        return ok({ success: true }, "Partnership updated");
    } catch (error: any) {
        console.error("[PATCH /api/venue/partnerships]", error);
        return fail("Failed to update partnership");
    }
}
