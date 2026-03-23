import { NextRequest } from "next/server";
import { z } from "zod";
import { listPartnerships, approvePartnership, rejectPartnership } from "@/lib/server/partnershipStore";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";

const PartnershipsQuery = z.object({
    venueId: z.string().optional(),
    hostId: z.string().optional(),
    status: z.string().optional(),
});

const UpdatePartnershipBody = z.object({
    partnershipId: z.string().min(1, "partnershipId is required"),
    action: z.enum(["approve", "reject"], { error: "action must be 'approve' or 'reject'" }),
});

export const GET = withAuth(async (req: NextRequest) => {
    try {
        const { searchParams } = new URL(req.url);
        const parsed = PartnershipsQuery.safeParse(Object.fromEntries(searchParams));
        if (!parsed.success) return fail(parsed.error.issues[0].message, 400);

        const filters: Record<string, string> = {};
        if (parsed.data.venueId) filters.venueId = parsed.data.venueId;
        if (parsed.data.hostId) filters.hostId = parsed.data.hostId;
        if (parsed.data.status) filters.status = parsed.data.status;

        const partnerships = await listPartnerships(filters);
        return ok({ partnerships });
    } catch (error: any) {
        console.error("[GET /api/venue/partnerships]", error);
        return fail("Failed to fetch partnerships");
    }
});

export const PATCH = withAuth(async (req: NextRequest) => {
    try {
        const rawBody = await req.json();
        const parsed = UpdatePartnershipBody.safeParse(rawBody);
        if (!parsed.success) return fail(parsed.error.issues[0].message, 400);

        const { partnershipId, action } = parsed.data;

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
});
