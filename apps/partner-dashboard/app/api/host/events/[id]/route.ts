/**
 * GET  /api/host/events/[id]   - Fetch full event detail for a host-owned event
 * PATCH /api/host/events/[id]  - Update host-safe event fields
 */
import { NextRequest, NextResponse } from "next/server";
import { requireHostAccess } from "@/lib/server/hostAuthMiddleware";
import { getAdminDb } from "@/lib/firebase/admin";

const GUEST_PORTAL_URL =
    process.env.NEXT_PUBLIC_GUEST_PORTAL_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "http://localhost:3000";

function toIso(value: any) {
    return value?.toDate?.()?.toISOString?.() ?? value ?? null;
}

function getEventTicketTiers(event: Record<string, any>) {
    if (Array.isArray(event.ticketTiers)) return event.ticketTiers;
    if (Array.isArray(event.tiers)) return event.tiers;
    if (Array.isArray(event.ticketCatalog?.tiers)) return event.ticketCatalog.tiers;
    if (Array.isArray(event.tickets)) return event.tickets;
    return [];
}

function normalizeTicketTier(tier: Record<string, any>) {
    const entryType = String(tier.entryType || "general").toLowerCase();
    const explicitRequirement = String(
        tier.genderRequirement ||
        tier.requiredGender ||
        tier.gender ||
        ""
    ).toLowerCase();

    let genderRequirement = "any";
    if (explicitRequirement === "female" || explicitRequirement === "male" || explicitRequirement === "couple") {
        genderRequirement = explicitRequirement;
    } else if (entryType === "female") {
        genderRequirement = "female";
    } else if (entryType === "stag" || entryType === "male") {
        genderRequirement = "male";
    }

    return {
        ...tier,
        entryType,
        genderRequirement,
    };
}

function buildSettings(data: Record<string, any>) {
    const settings = data.settings || {};
    const checkout = data.checkout || {};
    const marketing = data.marketing || {};
    const social = data.socialFeatures || data.social || {};
    const privacy = data.privacy || {};
    const policies = data.policies || {};
    const branding = data.branding || {};
    const embed = data.embed || {};

    return {
        eventInfo: {
            title: data.title || data.name || "",
            shortDescription: data.summary || data.shortDescription || "",
            description: data.description || "",
            venue: data.venueData?.name || data.venueName || data.venue || "",
            venueAddress: data.venueAddress || data.location || "",
            city: data.city || "",
            timezone: data.timezone || "Asia/Kolkata",
            startDate: toIso(data.startDate),
            endDate: toIso(data.endDate),
            doorsTime: data.doorsTime || "",
            displayEndTime: Boolean(data.displayEndTime),
            displayMultipleDays: Boolean(data.displayMultipleDays),
            publicVisibility: settings.showExplore ?? data.showExplore ?? true,
        },
        checkout: {
            confirmationMessage: checkout.confirmationMessage || data.confirmationMessage || "",
            includeFeesInPrice: Boolean(checkout.includeFeesInPrice ?? data.includeFeesInPrice),
            longFormButton: Boolean(checkout.longFormButton ?? data.longFormAddToCartButton),
            submitButtonText: checkout.submitButtonText || data.checkoutSubmitButtonText || "",
            helperText: checkout.helperText || data.checkoutHelperText || "",
            customFields: checkout.customFields || data.customCheckoutFields || [],
        },
        marketing: {
            thirdPartySiteDisplay: Boolean(marketing.thirdPartySiteDisplay ?? data.thirdPartySiteDisplay),
            facebookPixelId: marketing.facebookPixelId || data.facebookPixelId || "",
            tiktokPixelId: marketing.tiktokPixelId || data.tiktokPixelId || "",
            gtmId: marketing.gtmId || data.googleTagManagerId || data.gtmId || "",
        },
        socialFeatures: {
            disableGuestlist: Boolean(social.disableGuestlist ?? settings.showGuestlist === false),
            hideNumberAttending: Boolean(social.hideNumberAttending),
            guestlistDisplayThreshold: social.guestlistDisplayThreshold || 0,
            publicGuestlist: Boolean(social.publicGuestlist),
            activityEnabled: Boolean(social.activityEnabled ?? settings.activity ?? true),
        },
        privacy: {
            passwordProtected: Boolean(privacy.passwordProtected ?? settings.password),
            eventPassword: privacy.eventPassword || settings.password || data.eventPassword || "",
        },
        policies: {
            termsOfService: policies.termsOfService || data.termsOfService || "",
            refundPolicy: policies.refundPolicy || data.refundPolicy || "",
        },
        branding: {
            organizationDisplayName: branding.organizationDisplayName || data.organizationDisplayName || "",
            organizationDisplayLogo: branding.organizationDisplayLogo || data.organizationDisplayLogo || "",
        },
        embed: {
            enabled: Boolean(embed.enabled ?? data.embedEnabled),
            embedCode: embed.code || data.embedCode || "",
        },
    };
}

function ownsHostEvent(data: Record<string, any>, hostId: string) {
    return data.hostId === hostId || data.creatorId === hostId;
}

async function writeHostAuditLog(hostId: string, uid: string, action: string, meta: Record<string, any> = {}) {
    try {
        const db = getAdminDb();
        await db.collection("audit_logs").add({
            partnerId: hostId,
            partnerType: "host",
            hostId,
            uid,
            action,
            payload: meta,
            timestamp: Date.now(),
            createdAt: new Date().toISOString(),
        });
    } catch (error: any) {
        console.error("[host/events/[id]] audit write failed:", error?.message || error);
    }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const ctx = await requireHostAccess(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const { hostId } = ctx;

    try {
        const db = getAdminDb();
        const doc = await db.collection("events").doc(id).get();
        if (!doc.exists) return NextResponse.json({ error: "Event not found" }, { status: 404 });

        const data = doc.data()!;
        if (!ownsHostEvent(data, hostId)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const auditSnap = await db
            .collection("audit_logs")
            .where("partnerId", "==", hostId)
            .where("partnerType", "==", "host")
            .get();
        const auditTrail = auditSnap.docs
            .map((auditDoc) => auditDoc.data())
            .filter((entry) => entry?.eventId === id || entry?.payload?.eventId === id)
            .sort((a, b) => Number(b.timestamp || 0) - Number(a.timestamp || 0))
            .slice(0, 20)
            .map((entry) => ({
                action: entry.action,
                timestamp: entry.createdAt || new Date(entry.timestamp).toISOString(),
                actor: entry.uid,
            }));

        const event = {
            id: doc.id,
            title: data.title || data.name || "Untitled",
            lifecycle: data.lifecycle || data.status || "draft",
            startDate: toIso(data.startDate),
            endDate: toIso(data.endDate),
            venue: data.venueData?.name || data.venueName || data.venue || "TBD",
            venueId: data.venueId || null,
            hostId: data.hostId || data.creatorId || null,
            hostName: data.hostName || data.host || data.creatorName || null,
            venueAddress: data.venueAddress || data.location || null,
            city: data.city || null,
            capacity: data.capacity || data.totalCapacity || 0,
            coverImage: data.coverImage || data.coverPhoto || data.image || null,
            eventUrl: data.slug ? `${GUEST_PORTAL_URL}/e/${data.slug}` : `${GUEST_PORTAL_URL}/e/${doc.id}`,
            description: data.description || "",
            shortDescription: data.summary || data.shortDescription || "",
            tags: data.tags || [],
            ticketsSold: data.ticketsSold || 0,
            ticketTiers: getEventTicketTiers(data),
            promoterSettings: data.promoterSettings || {},
            createdAt: toIso(data.createdAt),
            updatedAt: toIso(data.updatedAt),
            settings: buildSettings(data),
            auditTrail,
            image: data.coverImage || data.coverPhoto || data.image || null,
            stats: data.stats || {},
        };

        return NextResponse.json({ event });
    } catch (err: any) {
        console.error("[host/events/[id]] GET error:", err.message);
        return NextResponse.json({ error: "Failed to fetch event" }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const ctx = await requireHostAccess(req, "MANAGE_EVENTS");
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const { hostId, uid } = ctx;

    try {
        const db = getAdminDb();
        const doc = await db.collection("events").doc(id).get();
        if (!doc.exists) return NextResponse.json({ error: "Event not found" }, { status: 404 });

        const existing = doc.data()!;
        if (!ownsHostEvent(existing, hostId)) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const lc = (existing.lifecycle || existing.status || "").toLowerCase();
        const isDraftLike = ["draft", "needs_changes"].includes(lc);
        const isLiveLike = ["live", "scheduled", "approved", "completed", "submitted"].includes(lc);
        if (!isDraftLike && !isLiveLike) {
            return NextResponse.json({ error: "Event cannot be edited in its current state" }, { status: 409 });
        }

        const body = await req.json();
        const updates: Record<string, any> = { updatedAt: new Date() };
        const fullEditFields = ["title", "description", "shortDescription", "summary", "tags", "startDate", "endDate", "doorsTime", "ticketTiers", "coverImage", "venue", "capacity", "venueAddress", "city", "timezone"];
        const safeLiveFields = [
            "description",
            "shortDescription",
            "summary",
            "tags",
            "coverImage",
            "confirmationMessage",
            "includeFeesInPrice",
            "longFormAddToCartButton",
            "checkoutSubmitButtonText",
            "checkoutHelperText",
            "customCheckoutFields",
            "thirdPartySiteDisplay",
            "facebookPixelId",
            "tiktokPixelId",
            "googleTagManagerId",
            "gtmId",
            "disableGuestlist",
            "hideNumberAttending",
            "guestlistDisplayThreshold",
            "publicGuestlist",
            "activityEnabled",
            "passwordProtected",
            "eventPassword",
            "termsOfService",
            "refundPolicy",
            "organizationDisplayName",
            "organizationDisplayLogo",
            "embedEnabled",
            "embedCode",
            "ticketTiers",
        ];

        const allowedFields = isDraftLike ? [...fullEditFields, ...safeLiveFields] : safeLiveFields;
        for (const key of allowedFields) {
            if (body[key] === undefined) continue;

            if (key === "shortDescription") {
                updates.summary = body[key];
            } else if (key === "confirmationMessage" || key === "includeFeesInPrice" || key === "checkoutSubmitButtonText" || key === "checkoutHelperText" || key === "customCheckoutFields" || key === "longFormAddToCartButton") {
                updates.checkout = {
                    ...(existing.checkout || {}),
                    ...(updates.checkout || {}),
                    ...(key === "confirmationMessage" ? { confirmationMessage: body[key] } : {}),
                    ...(key === "includeFeesInPrice" ? { includeFeesInPrice: body[key] } : {}),
                    ...(key === "checkoutSubmitButtonText" ? { submitButtonText: body[key] } : {}),
                    ...(key === "checkoutHelperText" ? { helperText: body[key] } : {}),
                    ...(key === "customCheckoutFields" ? { customFields: body[key] } : {}),
                    ...(key === "longFormAddToCartButton" ? { longFormButton: body[key] } : {}),
                };
            } else if (key === "thirdPartySiteDisplay" || key === "facebookPixelId" || key === "tiktokPixelId" || key === "googleTagManagerId" || key === "gtmId") {
                updates.marketing = {
                    ...(existing.marketing || {}),
                    ...(updates.marketing || {}),
                    ...(key === "thirdPartySiteDisplay" ? { thirdPartySiteDisplay: body[key] } : {}),
                    ...(key === "facebookPixelId" ? { facebookPixelId: body[key] } : {}),
                    ...(key === "tiktokPixelId" ? { tiktokPixelId: body[key] } : {}),
                    ...((key === "googleTagManagerId" || key === "gtmId") ? { gtmId: body[key] } : {}),
                };
            } else if (key === "disableGuestlist" || key === "hideNumberAttending" || key === "guestlistDisplayThreshold" || key === "publicGuestlist" || key === "activityEnabled") {
                updates.socialFeatures = {
                    ...(existing.socialFeatures || {}),
                    ...(updates.socialFeatures || {}),
                    ...(key === "disableGuestlist" ? { disableGuestlist: body[key] } : {}),
                    ...(key === "hideNumberAttending" ? { hideNumberAttending: body[key] } : {}),
                    ...(key === "guestlistDisplayThreshold" ? { guestlistDisplayThreshold: body[key] } : {}),
                    ...(key === "publicGuestlist" ? { publicGuestlist: body[key] } : {}),
                    ...(key === "activityEnabled" ? { activityEnabled: body[key] } : {}),
                };
            } else if (key === "passwordProtected" || key === "eventPassword") {
                updates.privacy = {
                    ...(existing.privacy || {}),
                    ...(updates.privacy || {}),
                    ...(key === "passwordProtected" ? { passwordProtected: body[key] } : {}),
                    ...(key === "eventPassword" ? { eventPassword: body[key] } : {}),
                };
            } else if (key === "termsOfService" || key === "refundPolicy") {
                updates.policies = {
                    ...(existing.policies || {}),
                    ...(updates.policies || {}),
                    ...(key === "termsOfService" ? { termsOfService: body[key] } : {}),
                    ...(key === "refundPolicy" ? { refundPolicy: body[key] } : {}),
                };
            } else if (key === "organizationDisplayName" || key === "organizationDisplayLogo") {
                updates.branding = {
                    ...(existing.branding || {}),
                    ...(updates.branding || {}),
                    ...(key === "organizationDisplayName" ? { organizationDisplayName: body[key] } : {}),
                    ...(key === "organizationDisplayLogo" ? { organizationDisplayLogo: body[key] } : {}),
                };
            } else if (key === "embedEnabled" || key === "embedCode") {
                updates.embed = {
                    ...(existing.embed || {}),
                    ...(updates.embed || {}),
                    ...(key === "embedEnabled" ? { enabled: body[key] } : {}),
                    ...(key === "embedCode" ? { code: body[key] } : {}),
                };
            } else {
                updates[key] = key === "ticketTiers" && Array.isArray(body[key])
                    ? body[key].map((tier: Record<string, any>) => normalizeTicketTier(tier))
                    : body[key];
            }
        }

        await db.collection("events").doc(id).update(updates);
        await writeHostAuditLog(hostId, uid, "event.update", { eventId: id, fields: Object.keys(body || {}) });
        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("[host/events/[id]] PATCH error:", err.message);
        return NextResponse.json({ error: "Failed to update event" }, { status: 500 });
    }
}
