/**
 * POST /api/venue/door/sell
 *
 * Creates a door entry (party walk-in or dine-in) during live event operations.
 *
 * Party:   writes to walk_in_entries/{eventId}/logs/, increments events.doorWalkInCount
 * Dine-in: writes to dinein_entries/{eventId}/logs/, no capacity change
 */

import { NextRequest, NextResponse } from "next/server";
import { requireVenueAccess } from "@/lib/rbac/staffProfileEnforcer";
import { requireAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";
import { logger } from "@/lib/server/logger";
import { createWalkIn } from "@/lib/server/walkInStore";
import { createDineinEntry } from "@/lib/server/doorSellStore";
import { getAdminDb, isFirebaseConfigured } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

const SellBodySchema = z.object({
    eventId: z.string().min(1).max(100),
    guestName: z.string().min(1).max(100),
    partySize: z.number().int().min(1).max(100),
    gender: z.enum(["male", "female"]),
    purpose: z.enum(["party", "dinein"]),
    idempotencyKey: z.string().min(1).max(200),
});

export async function POST(request: NextRequest) {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    try {
        const ctx = await requireVenueAccess(request, "walkins:create");
        if ("error" in ctx) return fail(ctx.error, ctx.status);

        const rawBody = await request.json();
        const parsed = SellBodySchema.safeParse(rawBody);
        if (!parsed.success) return fail(parsed.error.issues[0].message, 422);

        const { eventId, guestName, partySize, gender, purpose, idempotencyKey } = parsed.data;
        const venueId = ctx.venueId;
        const actor = { uid: auth.uid, name: (auth as any).name ?? "Staff" };

        // ── Party: capacity check + walk-in write ─────────────────────────────
        if (purpose === "party") {
            let remainingCapacity: number | null = null;

            if (isFirebaseConfigured()) {
                const db = getAdminDb();
                const eventRef = db.collection("events").doc(eventId);

                // Run inside a transaction to prevent race conditions
                const result = await db.runTransaction(async (tx) => {
                    const eventSnap = await tx.get(eventRef);
                    if (!eventSnap.exists) throw new Error("Event not found");

                    const data = eventSnap.data()!;
                    const total: number = data.capacity ?? 0;

                    // If no capacity set, treat as unlimited
                    if (total === 0) return { unlimited: true };

                    const sold: number = data.soldCount ?? 0;
                    const doorWalkIn: number = data.doorWalkInCount ?? 0;
                    const available = total - sold - doorWalkIn;

                    if (partySize > available) {
                        throw new Error(
                            available <= 0
                                ? "SOLD_OUT"
                                : `CAPACITY_SHORT:${available}`
                        );
                    }

                    tx.update(eventRef, {
                        doorWalkInCount: FieldValue.increment(partySize),
                    });

                    return { unlimited: false, remaining: available - partySize };
                });

                if (!result.unlimited) {
                    remainingCapacity = result.remaining ?? null;
                }
            }

            const entry = await createWalkIn(
                eventId,
                venueId,
                {
                    guestName,
                    partySize,
                    category: "general",
                    paymentMode: "cash",
                    amount: 0,
                    note: "",
                    idempotencyKey,
                    gender,
                    purpose,
                },
                actor,
                false
            );

            return ok({ entryId: entry.id, purpose: "party", remainingCapacity }, "", 201);
        }

        // ── Dine-in: no capacity check ────────────────────────────────────────
        const entry = await createDineinEntry(eventId, venueId, { guestName, partySize, idempotencyKey }, actor);

        return ok({ entryId: entry.id, purpose: "dinein", remainingCapacity: null }, "", 201);
    } catch (err: any) {
        if (err.message === "SOLD_OUT") {
            return fail("Event is sold out. No more entries can be added.", 409);
        }
        if (err.message?.startsWith("CAPACITY_SHORT:")) {
            const remaining = err.message.split(":")[1];
            return fail(`Only ${remaining} spot${Number(remaining) !== 1 ? "s" : ""} remaining. Reduce party size.`, 409);
        }
        logger.error("venue/door/sell", "Failed to create door entry", { error: err.message });
        return fail("Failed to create entry");
    }
}
