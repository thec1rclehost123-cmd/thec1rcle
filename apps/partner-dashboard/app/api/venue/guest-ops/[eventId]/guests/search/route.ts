import { NextRequest, NextResponse } from "next/server";
import { requireGuestOpsAccess, writeSecurityAuditLog } from "@/lib/server/guestOpsMiddleware";
import { searchGuests } from "@/lib/server/guestListStore";
import { getAdminDb } from "@/lib/firebase/admin";
import crypto from "crypto";

// Simple in-memory rate limiter (per uid, sliding window)
// In production this is backed by Redis — here we fall back to in-process
const searchCounts = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT = 30;
const WINDOW_MS = 60_000;
const SUSPICIOUS_THRESHOLD = 20;

function checkRateLimit(uid: string): boolean {
    const now = Date.now();
    const entry = searchCounts.get(uid);
    if (!entry || now - entry.windowStart > WINDOW_MS) {
        searchCounts.set(uid, { count: 1, windowStart: now });
        return true;
    }
    entry.count++;
    return entry.count <= RATE_LIMIT;
}

function isSuspicious(uid: string): boolean {
    const entry = searchCounts.get(uid);
    return entry ? entry.count > SUSPICIOUS_THRESHOLD : false;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ eventId: string }> }) {
    const { eventId } = await params;
    try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");

        const auth = await requireGuestOpsAccess(req, venueId!, eventId, ["VIEW_GUESTLIST"]);
        if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

        const { user, membership } = auth as any;

        // Rate limit
        if (!checkRateLimit(user.uid)) {
            return NextResponse.json({ error: "RATE_LIMITED", retryAfterMs: 5000 }, { status: 429 });
        }

        const q = searchParams.get("q") ?? "";
        const field = (searchParams.get("field") as "name" | "phone" | "ticketId" | "ref") ?? "name";

        if (q.length < 2) {
            return NextResponse.json({ results: [], matchedOn: field, ambiguous: false });
        }

        // Log suspicious lookups
        if (isSuspicious(user.uid)) {
            await writeSecurityAuditLog({
                venueId: venueId!,
                actorUid: user.uid,
                actorRole: membership.role,
                action: "suspicious_bulk_search",
                eventId,
                queryHash: crypto.createHash("sha256").update(q).digest("hex"),
                metadata: { field },
            });
        }

        const result = await searchGuests({ eventId, q, field }, membership.role);
        return NextResponse.json(result);
    } catch (err: any) {
        console.error("GET guest-ops/search error", err);
        return NextResponse.json({ error: "Search failed" }, { status: 500 });
    }
}
