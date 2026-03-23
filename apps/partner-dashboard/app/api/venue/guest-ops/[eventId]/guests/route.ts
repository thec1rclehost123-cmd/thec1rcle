import { NextRequest } from "next/server";
import { requireGuestOpsAccess } from "@/lib/server/guestOpsMiddleware";
import { listGuests, addGuest, getGuestRules } from "@/lib/server/guestListStore";
import { logger } from "@/lib/server/logger";
import { ok, fail } from "@/lib/server/apiResponse";

export async function GET(req: NextRequest, context: { params: { eventId: string } }) {
    try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");
        const eventId = context.params.eventId;

        const auth = await requireGuestOpsAccess(req, venueId!, eventId, ["VIEW_GUESTLIST"]);
        if ("error" in auth) return fail(auth.error, auth.status);

        const cursor = searchParams.get("cursor") ?? undefined;
        const limit = Math.min(Number(searchParams.get("limit") ?? 50), 500);
        const filter: any = {};
        if (searchParams.get("status")) filter.status = searchParams.get("status");
        if (searchParams.get("guestType")) filter.guestType = searchParams.get("guestType");
        if (searchParams.get("checkedIn") !== null) filter.checkedIn = searchParams.get("checkedIn") === "true";
        if (searchParams.get("hostId")) filter.hostId = searchParams.get("hostId");
        if (searchParams.get("promoterId")) filter.promoterId = searchParams.get("promoterId");
        const sortField = (searchParams.get("sortField") as any) ?? "addedAt";
        const sortDir = (searchParams.get("sortDir") as any) ?? "desc";

        const result = await listGuests(
            { eventId, cursor, limit, filter, sort: { field: sortField, dir: sortDir } },
            (auth as any).membership.role
        );
        return ok(result);
    } catch (err: any) {
        logger.error("venue/guest-ops/guests", "Failed to load guest list", { error: err.message });
        return fail("Failed to load guest list");
    }
}

export async function POST(req: NextRequest, context: { params: { eventId: string } }) {
    try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");
        const eventId = context.params.eventId;

        const auth = await requireGuestOpsAccess(req, venueId!, eventId, ["VIEW_GUESTLIST"]);
        if ("error" in auth) return fail(auth.error, auth.status);

        const { membership, user } = auth as any;
        // SECURITY cannot add guests
        if (membership.role === "SECURITY" || membership.role === "FINANCE_ADMIN") {
            return fail("Insufficient permissions", 403);
        }

        const body = await req.json();
        const rules = await getGuestRules(eventId);

        if (rules.isLocked) {
            return fail("EVENT_LOCKED", 409);
        }

        const actor = { uid: user.uid, name: user.name || user.email, role: membership.role };
        const result = await addGuest(eventId, venueId!, body, actor, rules);
        return ok(result);
    } catch (err: any) {
        if (err.code) {
            return fail(err.code, 409);
        }
        logger.error("venue/guest-ops/guests", "Failed to add guest", { error: err.message });
        return fail("Failed to add guest");
    }
}
