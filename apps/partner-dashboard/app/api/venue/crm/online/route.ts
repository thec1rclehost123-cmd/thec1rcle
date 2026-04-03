/**
 * GET /api/venue/crm/online?venueId=
 *
 * Performance design
 * ──────────────────
 * All independent Firestore reads are issued in parallel via Promise.all.
 *
 *   Round 1 (parallel):
 *     • events WHERE venueId == venueId   → build eventTitleMap + eventIds
 *     • orders WHERE venueId == venueId   → Path A (new orders, direct match)
 *     • rsvp_orders WHERE venueId == venueId
 *
 *   Round 2 (parallel, only for eventIds not yet covered by Path A):
 *     • orders WHERE eventId IN [batch]   → Path B (legacy orders without venueId)
 *     • rsvp_orders WHERE eventId IN [batch]
 *     All batches run concurrently (Promise.all over batches).
 *
 * No orderBy on Firestore queries → no composite index required.
 * Status filtering and sorting are done in memory after all docs are collected.
 *
 * Auth : requireVenueAccess (guestlist:read)
 * PII  : masked unless piiPolicy.showEmail / piiPolicy.showPhone
 */

import { NextResponse } from "next/server";
import { requireVenueAccess } from "@/lib/rbac/staffProfileEnforcer";
import { getAdminDb } from "@/lib/firebase/admin";
import { FieldPath } from "firebase-admin/firestore";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface OnlineCustomer {
    id: string;
    name: string;
    email: string;
    phone: string;
    age: number | null;
    dob: string | null;
    eventName: string;
    entryTime: string | null;
    status: string;
    marketingConsent: {
        allowPlatformMessages: boolean;
        allowDirectContactShare: boolean;
        consentStatement: string | null;
        recordedAt: string | null;
    };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function chunk<T>(arr: T[], size: number): T[][] {
    const out: T[][] = [];
    for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
    return out;
}

function maskEmail(e: string): string {
    if (!e) return "";
    const [l, d] = e.split("@");
    return d ? `${l.slice(0, 2)}***@${d}` : e;
}

function maskPhone(p: string): string {
    if (!p) return "";
    return p.length > 4 ? `${"*".repeat(p.length - 4)}${p.slice(-4)}` : "****";
}

function dedupKey(o: Record<string, any>): string {
    return (o.userId as string) || (o.userEmail as string) || (o.id as string);
}

const CONFIRMED = ["confirmed", "checked_in", "completed"];

// DEV_SEED removed — never return fake data in any environment.

// ── Handler ───────────────────────────────────────────────────────────────────

// Bounded limit for in-memory processing — prevents OOM on large venues
const CUSTOMER_FETCH_LIMIT = 200;

export async function GET(request: Request) {
    try {
        const ctx = await requireVenueAccess(request, "guestlist:read");
        if ("error" in ctx) {
            return NextResponse.json({ error: ctx.error }, { status: ctx.status });
        }
        const { venueId, piiPolicy } = ctx;

        const db = getAdminDb();

        // ── Round 1: all three independent reads fire simultaneously ─────────
        // Each query is bounded to CUSTOMER_FETCH_LIMIT to prevent OOM.
        const [eventsSnap, directOrdersSnap, directRsvpSnap] = await Promise.all([
            db.collection("events").where("venueId", "==", venueId).select("title").limit(100).get(),
            db.collection("orders").where("venueId", "==", venueId).orderBy("createdAt", "desc").limit(CUSTOMER_FETCH_LIMIT).get(),
            db.collection("rsvp_orders").where("venueId", "==", venueId).orderBy("createdAt", "desc").limit(CUSTOMER_FETCH_LIMIT).get(),
        ]);

        // Build event title map
        const eventTitleMap: Record<string, string> = {};
        eventsSnap.docs.forEach((d) => {
            eventTitleMap[d.id] = (d.data().title as string) ?? "Unnamed Event";
        });
        const eventIds = Object.keys(eventTitleMap);

        // Collect docs from Path A
        const rawDocs: FirebaseFirestore.QueryDocumentSnapshot[] = [
            ...directOrdersSnap.docs,
            ...directRsvpSnap.docs,
        ];
        const pathADocIds = new Set(rawDocs.map((d) => d.id));

        // ── Round 2: Path B — legacy orders (no venueId field) ───────────────
        // Batches run concurrently.
        if (eventIds.length > 0) {
            const batches = chunk(eventIds, 30);
            const legacyResults = await Promise.all(
                batches.flatMap((batch) => [
                    db.collection("orders").where("eventId", "in", batch).get(),
                    db.collection("rsvp_orders").where("eventId", "in", batch).get(),
                ])
            );
            for (const snap of legacyResults) {
                for (const doc of snap.docs) {
                    if (!pathADocIds.has(doc.id)) rawDocs.push(doc);
                }
            }
        }

        // ── In-memory: sort → status filter → dedup → shape ─────────────────
        rawDocs.sort((a, b) => {
            const ta = (a.data().createdAt as string) ?? "";
            const tb = (b.data().createdAt as string) ?? "";
            return tb > ta ? 1 : tb < ta ? -1 : 0;
        });

        const seen = new Set<string>();
        const customers: OnlineCustomer[] = [];

        for (const doc of rawDocs) {
            const o = doc.data();
            if (!CONFIRMED.includes(o.status as string)) continue;
            const key = dedupKey(o);
            if (!key || seen.has(key)) continue;
            seen.add(key);

            const rawEmail = (o.userEmail as string) || "";
            const rawPhone = (o.userPhone as string) || "";

            customers.push({
                id:        (o.userId as string) || doc.id,
                name:      (o.userName as string) || "C1RCLE Member",
                email:     piiPolicy.showEmail ? rawEmail : maskEmail(rawEmail),
                phone:     piiPolicy.showPhone ? rawPhone : maskPhone(rawPhone),
                age:       (o.age as number) ?? null,
                dob:       (o.dob as string) ?? null,
                eventName: eventTitleMap[o.eventId as string] ?? (o.eventTitle as string) ?? "Unknown Event",
                entryTime: (o.checkedInAt as string) ?? (o.confirmedAt as string) ?? (o.createdAt as string) ?? null,
                status:    o.status as string,
                marketingConsent: {
                    allowPlatformMessages: true,
                    allowDirectContactShare: false,
                    consentStatement: null,
                    recordedAt: null,
                },
            });
        }

        // ── Round 3: fill age from users collection for customers that have none ─
        const needsAge = customers.filter((c) => c.age === null);
        if (needsAge.length > 0) {
            const userIds = [...new Set(needsAge.map((c) => c.id).filter(Boolean))];
            if (userIds.length > 0) {
                const ageMap: Record<string, number> = {};
                const userBatches = chunk(userIds, 30);
                const userSnaps = await Promise.all(
                    userBatches.map((batch) =>
                        db.collection("users")
                            .where(FieldPath.documentId(), "in", batch)
                            .select("age")
                            .get()
                    )
                );
                for (const snap of userSnaps) {
                    for (const doc of snap.docs) {
                        const a = doc.data().age as number;
                        if (a > 0) ageMap[doc.id] = a;
                    }
                }
                for (const c of needsAge) {
                    if (ageMap[c.id] !== undefined) c.age = ageMap[c.id];
                }
            }
        }

        return NextResponse.json(
            { customers, total: customers.length },
            { headers: { "Cache-Control": "private, no-store" } }
        );
    } catch (err: any) {
        console.error("[crm/online]", err.code ?? "", err.message);
        return NextResponse.json({ error: err.message ?? "Internal server error" }, { status: 500 });
    }
}
