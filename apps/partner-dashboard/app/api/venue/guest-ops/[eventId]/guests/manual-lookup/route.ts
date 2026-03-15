import { NextRequest, NextResponse } from "next/server";
import { requireGuestOpsAccess, writeSecurityAuditLog } from "@/lib/server/guestOpsMiddleware";
import { searchGuests } from "@/lib/server/guestListStore";
import crypto from "crypto";

const lookupCounts = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT = 30;
const WINDOW_MS = 60_000;
const SUSPICIOUS_THRESHOLD = 20;

function checkRateLimit(uid: string): boolean {
    const now = Date.now();
    const entry = lookupCounts.get(uid);
    if (!entry || now - entry.windowStart > WINDOW_MS) {
        lookupCounts.set(uid, { count: 1, windowStart: now });
        return true;
    }
    entry.count++;
    return entry.count <= RATE_LIMIT;
}

export async function POST(req: NextRequest, { params }: { params: { eventId: string } }) {
    try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");
        const { eventId } = params;

        const auth = await requireGuestOpsAccess(req, venueId!, eventId, ["VIEW_GUESTLIST"]);
        if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

        const { user, membership } = auth as any;

        if (!checkRateLimit(user.uid)) {
            return NextResponse.json({ error: "RATE_LIMITED", retryAfterMs: 5000 }, { status: 429 });
        }

        const { query: q, field } = await req.json();
        if (!q || q.length < 2) {
            return NextResponse.json({ results: [], matchType: "none", count: 0 });
        }

        const lookupEntry = lookupCounts.get(user.uid);
        if (lookupEntry && lookupEntry.count > SUSPICIOUS_THRESHOLD) {
            await writeSecurityAuditLog({
                venueId: venueId!, actorUid: user.uid, actorRole: membership.role,
                action: "suspicious_bulk_lookup", eventId,
                queryHash: crypto.createHash("sha256").update(q).digest("hex"),
                metadata: { field },
            });
        }

        const result = await searchGuests({ eventId, q, field }, membership.role);
        const matchType = result.results.length === 0 ? "none"
            : field === "phone" || field === "ticketId" || field === "ref" ? "exact"
            : "fuzzy";

        return NextResponse.json({ results: result.results, matchType, count: result.results.length, ambiguous: result.ambiguous });
    } catch (err: any) {
        console.error("POST manual-lookup error", err);
        return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
    }
}
