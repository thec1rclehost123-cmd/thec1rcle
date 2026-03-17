import { NextRequest, NextResponse } from "next/server";
import { requireGuestOpsAccess, writeSecurityAuditLog, writeOverrideLog } from "@/lib/server/guestOpsMiddleware";
import { getGuestRules } from "@/lib/server/guestListStore";
import { getAdminDb } from "@/lib/firebase/admin";

// Export rate limit: 5 per event per day (in-memory fallback; use Redis in prod)
const exportCounts = new Map<string, { count: number; date: string }>();
const EXPORT_DAILY_LIMIT = 5;

export async function GET(req: NextRequest, { params }: { params: { eventId: string } }) {
    try {
        const { searchParams } = new URL(req.url);
        const venueId = searchParams.get("venueId");
        const { eventId } = params;

        // Export is OWNER-only
        const auth = await requireGuestOpsAccess(req, venueId!, eventId, ["EXPORT_GUESTS"]);
        if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

        const { membership, user } = auth as any;
        if (membership.role !== "OWNER") {
            return NextResponse.json({ error: "EXPORT_OWNER_ONLY", message: "Guest data export requires OWNER role" }, { status: 403 });
        }

        const rules = await getGuestRules(eventId);
        if (!rules.exportEnabled) {
            return NextResponse.json({ error: "EXPORT_DISABLED", message: "Export is disabled for this event" }, { status: 409 });
        }

        const format = (searchParams.get("format") ?? "csv") as "csv" | "json";
        const piiLevel = (searchParams.get("piiLevel") ?? "masked") as "no_pii" | "masked" | "full";
        const reason = searchParams.get("reason") ?? "";

        if (piiLevel === "full" && reason.length < 20) {
            return NextResponse.json({ error: "REASON_REQUIRED", message: "Full PII export requires a written reason of at least 20 characters" }, { status: 400 });
        }

        // Daily rate limit
        const today = new Date().toISOString().split("T")[0];
        const key = `${eventId}:${venueId}`;
        const entry = exportCounts.get(key);
        if (entry && entry.date === today && entry.count >= EXPORT_DAILY_LIMIT) {
            return NextResponse.json({ error: "EXPORT_LIMIT_EXCEEDED", message: `Max ${EXPORT_DAILY_LIMIT} exports per event per day` }, { status: 429 });
        }
        exportCounts.set(key, { count: (entry?.date === today ? entry.count + 1 : 1), date: today });

        // Log the export request
        await writeSecurityAuditLog({
            venueId: venueId!, actorUid: user.uid, actorRole: membership.role,
            action: "export_requested", eventId, queryHash: undefined,
            metadata: { format, piiLevel, reason: reason.substring(0, 200) },
        });

        const db = getAdminDb();
        await writeOverrideLog(db, {
            eventId, venueId: venueId!,
            action: "export_requested",
            actorUid: user.uid, actorName: user.name || user.email, actorRole: membership.role,
            targetGuestId: "", targetGuestName: "all_guests",
            reason: reason || "Export requested",
            metadata: { format, piiLevel },
        });

        // Queue an Inngest job for large exports; for small events, do inline
        const snap = await db.collection("guest_lists").doc(eventId).collection("guests")
            .where("isRemoved", "==", false)
            .limit(1000)
            .get();

        const guests = snap.docs.map(doc => {
            const g = doc.data();
            if (piiLevel === "no_pii") {
                return { guestId: doc.id, guestType: g.guestType, source: g.source, status: g.status, checkedIn: g.checkedIn, addedAt: g.addedAt };
            } else if (piiLevel === "masked") {
                return { guestId: doc.id, displayName: g.displayName, maskedPhone: g.maskedPhone, guestType: g.guestType, source: g.source, status: g.status, checkedIn: g.checkedIn, checkedInAt: g.checkedInAt, addedAt: g.addedAt };
            } else {
                return { guestId: doc.id, firstName: g.firstName, lastName: g.lastName, fullPhone: g.normalizedPhone, guestType: g.guestType, source: g.source, status: g.status, checkedIn: g.checkedIn, checkedInAt: g.checkedInAt, addedAt: g.addedAt, notes: g.notes };
            }
        });

        if (format === "csv") {
            if (guests.length === 0) return NextResponse.json({ data: "", format: "csv", rowCount: 0 });
            const headers = Object.keys(guests[0]).join(",");
            const rows = guests.map(g => Object.values(g).map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
            const csv = [headers, ...rows].join("\n");
            return new NextResponse(csv, {
                headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename="guests-${eventId}.csv"` },
            });
        }

        return NextResponse.json({ guests, rowCount: guests.length, format: "json", exportedAt: new Date().toISOString() });
    } catch (err: any) {
        console.error("GET export error", err);
        return NextResponse.json({ error: "Export failed" }, { status: 500 });
    }
}
