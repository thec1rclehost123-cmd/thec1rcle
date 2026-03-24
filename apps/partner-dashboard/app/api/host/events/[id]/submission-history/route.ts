/**
 * GET /api/host/events/[id]/submission-history
 * Returns the chronological submission timeline for an event.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireHostAccess } from "@/lib/server/hostAuthMiddleware";
import { getAdminDb } from "@/lib/firebase/admin";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const ctx = await requireHostAccess(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const { hostId } = ctx as any;

    const eventId = id;
    const db = getAdminDb();

    try {
        const eventDoc = await db.collection("events").doc(eventId).get();
        if (!eventDoc.exists) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const ev = eventDoc.data()!;
        if (ev.hostId !== hostId && ev.creatorId !== hostId) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        // Submission history stored on event document or in subcollection
        const submissionsSnap = await db
            .collection("events").doc(eventId)
            .collection("submission_history")
            .orderBy("createdAt", "asc")
            .get();

        if (!submissionsSnap.empty) {
            const history = submissionsSnap.docs.map(d => ({
                status: d.data().status,
                note: d.data().note || d.data().hostNote || d.data().venueNote || "",
                at: d.data().createdAt || new Date().toISOString(),
                actor: d.data().actor || "host",
            }));
            return NextResponse.json({ history });
        }

        // Fallback: build from audit_logs
        const auditSnap = await db.collection("audit_logs")
            .where("eventId", "==", eventId)
            .where("action", "in", ["event.submit", "event.resubmit", "event.approve", "event.deny", "event.needs_changes"])
            .orderBy("timestamp", "asc")
            .limit(20)
            .get();

        const history = auditSnap.docs.map(d => ({
            status: d.data().action?.replace("event.", "") || "unknown",
            note: d.data().payload?.note || "",
            at: d.data().createdAt || new Date(d.data().timestamp).toISOString(),
            actor: d.data().uid === hostId ? "host" : "venue",
        }));

        // Always include draft as first entry
        if (ev.createdAt) {
            history.unshift({
                status: "draft",
                note: "Event created",
                at: ev.createdAt?.toDate?.()?.toISOString() ?? ev.createdAt,
                actor: "host",
            });
        }

        return NextResponse.json({ history });
    } catch (err: any) {
        console.error("[submission-history]", err.message);
        return NextResponse.json({ error: "Failed to fetch submission history" }, { status: 500 });
    }
}
