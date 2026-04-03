import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireHostAccess } from "@/lib/server/hostAuthMiddleware";
import { getAdminDb } from "@/lib/firebase/admin";
import { approvePartnership, rejectPartnership } from "@/lib/server/partnershipStore";
import { listPartnerships } from "@/lib/server/partnershipStore";
import { fail, ok } from "@/lib/server/apiResponse";

const UpdatePartnershipBody = z.object({
    partnershipId: z.string().min(1, "partnershipId is required"),
    action: z.enum(["approve", "reject"], { error: "action must be 'approve' or 'reject'" }),
});

const PartnershipQuery = z.object({
    status: z.string().optional(),
});

export async function GET(req: NextRequest) {
    const ctx = await requireHostAccess(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    try {
        const { searchParams } = new URL(req.url);
        const parsed = PartnershipQuery.safeParse(Object.fromEntries(searchParams));
        if (!parsed.success) return fail(parsed.error.issues[0].message, 400);

        const partnerships = await listPartnerships({
            hostId: ctx.hostId,
            ...(parsed.data.status ? { status: parsed.data.status } : {}),
        });

        return ok({ partnerships });
    } catch (error: any) {
        console.error("[GET /api/host/partnerships]", error);
        return fail("Failed to fetch partnerships");
    }
}

export async function PATCH(req: NextRequest) {
    const ctx = await requireHostAccess(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    try {
        const rawBody = await req.json();
        const parsed = UpdatePartnershipBody.safeParse(rawBody);
        if (!parsed.success) return fail(parsed.error.issues[0].message, 400);

        const { partnershipId, action } = parsed.data;
        const db = getAdminDb();
        const partnershipDoc = await db.collection("partnerships").doc(partnershipId).get();
        if (!partnershipDoc.exists) return fail("Partnership not found", 404);

        const partnership = partnershipDoc.data() || {};
        if (partnership.hostId !== ctx.hostId) return fail("Forbidden", 403);
        if (partnership.status !== "pending") return fail("Partnership is no longer pending", 409);
        if (partnership.initiatedBy !== "venue") return fail("Only incoming venue requests can be updated here", 409);

        if (action === "approve") {
            await approvePartnership(partnershipId);
        } else {
            await rejectPartnership(partnershipId);
        }

        return ok({ success: true }, "Partnership updated");
    } catch (error: any) {
        console.error("[PATCH /api/host/partnerships]", error);
        return fail("Failed to update partnership");
    }
}
