import { NextRequest, NextResponse } from "next/server";
import { requireGuestOpsAccess } from "@/lib/server/guestOpsMiddleware";
import { listGuests, addGuest, getGuestRules } from "@/lib/server/guestListStore";

export async function GET(req: NextRequest, { params }: { params: { eventId: string } }) {
    try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");
        const { eventId } = params;

        const auth = await requireGuestOpsAccess(req, venueId!, eventId, ["VIEW_GUESTLIST"]);
        if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

        const cursor = searchParams.get("cursor") ?? undefined;
        const limit = Number(searchParams.get("limit") ?? 50);
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
        return NextResponse.json(result);
    } catch (err: any) {
        console.error("GET guest-ops/guests error", err);
        return NextResponse.json({ error: "Failed to load guest list" }, { status: 500 });
    }
}

export async function POST(req: NextRequest, { params }: { params: { eventId: string } }) {
    try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");
        const { eventId } = params;

        const auth = await requireGuestOpsAccess(req, venueId!, eventId, ["VIEW_GUESTLIST"]);
        if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

        const { membership, user } = auth as any;
        // SECURITY cannot add guests
        if (membership.role === "SECURITY" || membership.role === "FINANCE_ADMIN") {
            return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
        }

        const body = await req.json();
        const rules = await getGuestRules(eventId);

        if (rules.isLocked) {
            return NextResponse.json({ error: "EVENT_LOCKED", message: "Event is locked" }, { status: 409 });
        }

        const actor = { uid: user.uid, name: user.name || user.email, role: membership.role };
        const result = await addGuest(eventId, venueId!, body, actor, rules);
        return NextResponse.json(result, { status: 201 });
    } catch (err: any) {
        if (err.code) {
            return NextResponse.json({ error: err.code, message: err.message, ...err }, { status: 409 });
        }
        console.error("POST guest-ops/guests error", err);
        return NextResponse.json({ error: "Failed to add guest" }, { status: 500 });
    }
}
