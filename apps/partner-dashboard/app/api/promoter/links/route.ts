import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { canPromoterCreateLink, getPromoterEligibleTicketTiers } from "@c1rcle/core/events";
import {
    createPromoterLink,
    listPromoterLinks,
} from "@/lib/server/promoterLinkStore";
import { getAdminDb } from "@/lib/firebase/admin";
import { getEvent } from "@/lib/server/eventStore";
import { requirePromoterAccess } from "@/lib/server/promoterAuthMiddleware";
import { ok, fail } from "@/lib/server/apiResponse";

const LinksQuery = z.object({
    eventId:  z.string().optional(),
    isActive: z.enum(["true", "false"]).optional(),
    limit:    z.coerce.number().int().positive().max(200).default(50),
});

const CreateLinkBody = z.object({
    eventId:          z.string().min(1, "eventId is required"),
    promoterName:     z.string().optional(),
    campaignLabel:    z.string().optional(),
    channel:          z.string().optional(),
    ticketTierIds:    z.array(z.string()).optional(),
    customCommission: z.number().positive().optional(),
});

function normalizePromoterHandle(value: string | null | undefined) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/^@/, "")
        .replace(/[^\w-]/g, "");
}

function isPromoterAllowedForEvent(event: any, promoterId: string) {
    const globallyEnabled = event?.promotersEnabled === true || event?.promoterSettings?.enabled === true;
    if (!globallyEnabled) return false;

    const allowedPromoterIds = Array.isArray(event?.promoterSettings?.allowedPromoterIds)
        ? event.promoterSettings.allowedPromoterIds.map((id: string) => String(id))
        : [];

    return allowedPromoterIds.length === 0 || allowedPromoterIds.includes(String(promoterId));
}

/**
 * GET /api/promoter/links
 * promoterId resolved from RBAC — never from query string.
 */
export async function GET(req: NextRequest) {
    const ctx = await requirePromoterAccess(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    try {
        const { searchParams } = new URL(req.url);
        const parsed = LinksQuery.safeParse(Object.fromEntries(searchParams));
        if (!parsed.success) return fail(parsed.error.issues[0].message, 400);

        const { eventId, isActive, limit } = parsed.data;
        const links = await listPromoterLinks({
            promoterId: ctx.promoterId,
            eventId,
            isActive: isActive === "true" ? true : isActive === "false" ? false : undefined,
            limit,
        });
        return ok({ links });
    } catch (error: any) {
        console.error("[GET /api/promoter/links]", error);
        return fail("Failed to fetch links");
    }
}

/**
 * POST /api/promoter/links
 * Create a new promoter link for an event.
 * promoterId resolved from RBAC — never accepted from request body.
 */
export async function POST(req: NextRequest) {
    const ctx = await requirePromoterAccess(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    try {
        const rawBody = await req.json();
        const parsed  = CreateLinkBody.safeParse(rawBody);
        if (!parsed.success) return fail(parsed.error.issues[0].message, 400);

        const { eventId, promoterName, campaignLabel, channel, ticketTierIds, customCommission } = parsed.data;
        const promoterId = ctx.promoterId;

        const event = await getEvent(eventId);
        if (!event) return fail("Event not found", 404);

        const db = getAdminDb();
        const [promoterDoc, userDoc] = await Promise.all([
            db.collection("promoters").doc(String(promoterId)).get(),
            db.collection("users").doc(String(ctx.uid)).get(),
        ]);
        const promoterData = promoterDoc.data() || {};
        const userData = userDoc.data() || {};
        const promoterHandle = normalizePromoterHandle(
            promoterData.handle ||
            promoterData.username ||
            userData.handle ||
            userData.username ||
            null
        ) || null;

        if (promoterHandle && (!promoterData.handle || !promoterData.username)) {
            await db.collection("promoters").doc(String(promoterId)).set({
                handle: promoterHandle,
                username: promoterHandle,
                updatedAt: new Date().toISOString(),
            }, { merge: true });
        }

        const connectionsSnap = await db.collection("promoter_connections")
            .where("promoterId", "==", promoterId)
            .where("status", "in", ["approved", "active"])
            .get();
        const approvedTargetIds = new Set(connectionsSnap.docs.map((doc) => String(doc.data()?.targetId || "")));
        const connectionCandidateIds = [
            event.hostId,
            event.venueId,
            event.creatorId,
        ].filter(Boolean).map((value: string) => String(value));

        const hasApprovedConnection = connectionCandidateIds.some((candidateId) => approvedTargetIds.has(candidateId));

        if (!hasApprovedConnection) {
            return fail("You must be connected with the host or venue to promote this event", 403);
        }

        if (!canPromoterCreateLink(event)) {
            return fail("Event is not available for promoter links", 403);
        }

        if (!isPromoterAllowedForEvent(event, promoterId)) {
            return fail("This event is not enabled for your promoter account", 403);
        }

        const eligibleTierIds = getPromoterEligibleTicketTiers(event).map((tier: any) => String(tier.id));
        if (eligibleTierIds.length === 0) {
            return fail("This event has no promotable paid tiers", 403);
        }

        const requestedTierIds = Array.isArray(ticketTierIds)
            ? ticketTierIds.map((tierId) => String(tierId))
            : [];
        const invalidTierIds = requestedTierIds.filter((tierId) => !eligibleTierIds.includes(tierId));
        if (invalidTierIds.length > 0) {
            return fail("Selected ticket tiers are not promotable", 400);
        }

        const commissionRate = customCommission || event.promoterSettings?.defaultCommission || event.commission || 15;

        const link = await createPromoterLink({
            promoterId,
            promoterName: promoterName || ctx.displayName || "Promoter",
            eventId,
            eventTitle:    event.title,
            campaignLabel: campaignLabel || undefined,
            channel:       channel || undefined,
            ticketTierIds: requestedTierIds.length > 0 ? requestedTierIds : eligibleTierIds,
            commissionRate,
            commissionType: "percentage",
            promoterHandle,
        });

        return ok({ link, duplicate: false }, "Link created", 201);
    } catch (error: any) {
        console.error("[POST /api/promoter/links]", error);
        if (error.status === 409 || error.message?.includes("already") || error.message?.includes("exists")) {
            const existingLink = error.data?.link || null;
            return ok({ link: existingLink, duplicate: true });
        }
        return fail("Failed to create promoter link");
    }
}
