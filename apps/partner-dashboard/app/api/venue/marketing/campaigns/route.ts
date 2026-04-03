import { NextRequest } from "next/server";
import { requireVenueAccess } from "@/lib/rbac/staffProfileEnforcer";
import { getAdminDb } from "@/lib/firebase/admin";
import { fail, ok } from "@/lib/server/apiResponse";

type CampaignStatus = "queued" | "sent" | "failed";

export async function GET(request: NextRequest) {
    const ctx = await requireVenueAccess(request, "analytics:read");
    if ("error" in ctx) {
        return fail(ctx.error, ctx.status);
    }

    if (!["OWNER", "MANAGER"].includes(ctx.baseRole)) {
        return fail("Only owner and manager roles can access campaign history", 403);
    }

    const db = getAdminDb();
    const snapshot = await db
        .collection("venues")
        .doc(ctx.venueId)
        .collection("marketing_campaigns")
        .orderBy("createdAt", "desc")
        .limit(25)
        .get();

    return ok({
        campaigns: snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
        })),
    });
}

export async function POST(request: NextRequest) {
    const ctx = await requireVenueAccess(request, "analytics:read");
    if ("error" in ctx) {
        return fail(ctx.error, ctx.status);
    }

    if (!["OWNER", "MANAGER"].includes(ctx.baseRole)) {
        return fail("Only owner and manager roles can launch marketing campaigns", 403);
    }

    const body = await request.json().catch(() => null);
    if (!body) {
        return fail("Invalid JSON body", 400);
    }

    const recipientIds = Array.isArray(body.recipientIds)
        ? body.recipientIds.map((value: unknown) => String(value || "").trim()).filter(Boolean)
        : [];
    const message = String(body.message || "").trim();

    if (recipientIds.length === 0) {
        return fail("Select at least one recipient", 422);
    }

    if (!message) {
        return fail("Message is required", 422);
    }

    const now = new Date().toISOString();
    const db = getAdminDb();
    const campaignRef = db
        .collection("venues")
        .doc(ctx.venueId)
        .collection("marketing_campaigns")
        .doc();

    const status: CampaignStatus = "queued";
    const payload = {
        venueId: ctx.venueId,
        createdByUid: ctx.uid,
        createdByRole: ctx.baseRole,
        deliveryMode: "platform_managed",
        channel: "sms",
        message,
        recipientIds,
        recipientCount: recipientIds.length,
        directContactShareEnabled: false,
        status,
        createdAt: now,
        updatedAt: now,
    };

    await Promise.all([
        campaignRef.set(payload),
        db.collection("audit_logs").add({
            partnerId: ctx.venueId,
            partnerType: "venue",
            uid: ctx.uid,
            action: "marketing.campaign.queued",
            payload: {
                campaignId: campaignRef.id,
                recipientCount: recipientIds.length,
                deliveryMode: "platform_managed",
                directContactShareEnabled: false,
            },
            timestamp: Date.now(),
            createdAt: now,
        }),
    ]);

    return ok(
        {
            campaign: {
                id: campaignRef.id,
                ...payload,
            },
        },
        "Campaign queued for platform delivery",
        201
    );
}
