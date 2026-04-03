/**
 * GET  /api/venue/finance/venue-payouts?venueId=&cursor=
 * POST /api/venue/finance/venue-payouts — initiate payout
 *
 * POST is fully idempotent: supply an idempotencyKey; repeating the same key
 * returns the existing payout_requests doc without double-processing.
 *
 * Feature flag: payoutsEnabled must be true in system_config/feature_flags.
 * Rate limit: 5 payout initiations per user per hour.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireVenueAccess } from "@/lib/rbac/staffProfileEnforcer";
import { getVenuePayoutsData } from "@/lib/server/splitFinanceStore";
import { getAdminDb, isFirebaseConfigured } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { checkRateLimit } from "@/lib/server/rateLimit";

// ── Shared feature flag reader ────────────────────────────────────────────────

async function isPayoutsEnabled(): Promise<boolean> {
    if (!isFirebaseConfigured()) return false;
    try {
        const db  = getAdminDb();
        const doc = await db.collection("system_config").doc("feature_flags").get();
        return doc.exists ? (doc.data()?.payoutsEnabled === true) : false;
    } catch {
        return false;
    }
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
    try {
        const ctx = await requireVenueAccess(request, "finance:read_payouts");
        if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

        if (!ctx.piiPolicy.showPayoutAmounts && !["OWNER", "FINANCE_ADMIN"].includes(ctx.baseRole)) {
            return NextResponse.json({ error: "Insufficient access" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const token = request.headers.get("Authorization")?.replace("Bearer ", "") ?? "";

        const data = await getVenuePayoutsData(
            ctx.venueId,
            token,
            searchParams.get("cursor") ?? undefined
        );

        return NextResponse.json(data, {
            headers: { "Cache-Control": "private, max-age=30" },
        });
    } catch (err: any) {
        console.error("[finance/venue-payouts GET]", err.message);
        return NextResponse.json({ error: "Failed to fetch venue payouts" }, { status: 500 });
    }
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
    // 1. Feature flag gate
    if (!(await isPayoutsEnabled())) {
        return NextResponse.json({ error: "Payout feature is temporarily unavailable" }, { status: 503 });
    }

    // 2. RBAC — requires finance:initiate_payout (OWNER / FINANCE_ADMIN only)
    const ctx = await requireVenueAccess(request, "finance:initiate_payout");
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    if (!["OWNER", "FINANCE_ADMIN"].includes(ctx.baseRole)) {
        return NextResponse.json({ error: "Finance admin role required" }, { status: 403 });
    }

    // 3. Rate limit: 5 payout initiations per user per hour
    const rateLimitKey = `payout:${ctx.uid}`;
    const allowed = await checkRateLimit(rateLimitKey, 5, 3600).catch(() => true);
    if (!allowed) {
        return NextResponse.json({ error: "Too many payout requests. Try again later." }, { status: 429 });
    }

    const db = getAdminDb();

    try {
        const body = await request.json();

        // 4. Validate required fields
        if (!body.amountPaise || body.amountPaise < 100) {
            return NextResponse.json({ error: "Minimum payout is ₹1 (100 paise)" }, { status: 422 });
        }
        if (!body.methodId) {
            return NextResponse.json({ error: "methodId required" }, { status: 422 });
        }
        if (!body.idempotencyKey || typeof body.idempotencyKey !== "string") {
            return NextResponse.json({ error: "idempotencyKey is required (UUID)" }, { status: 422 });
        }

        const { amountPaise, methodId, idempotencyKey } = body;
        const { venueId, uid } = ctx;

        // 5. Idempotency check — return existing if same key was already used
        const existingSnap = await db.collection("payout_requests")
            .where("venueId", "==", venueId)
            .where("idempotencyKey", "==", idempotencyKey)
            .limit(1)
            .get();

        if (!existingSnap.empty) {
            const existing = existingSnap.docs[0];
            return NextResponse.json({
                payoutId:    existing.id,
                status:      existing.data().status,
                idempotent:  true,
            }, { status: 200 });
        }

        // 6. Write payout_requests doc (pending) — before calling provider
        const payoutRef = db.collection("payout_requests").doc();
        const now       = new Date().toISOString();

        await payoutRef.set({
            payoutId:       payoutRef.id,
            venueId,
            initiatedBy:    uid,
            amountPaise,
            methodId,
            idempotencyKey,
            status:         "pending",
            providerRef:    null,
            createdAt:      now,
            updatedAt:      now,
        });

        // 7. Write audit log — initiation
        await db.collection("audit_logs").add({
            action:     "payout:initiated",
            venueId,
            uid,
            payoutId:   payoutRef.id,
            amountPaise,
            methodId,
            status:     "pending",
            createdAt:  now,
            timestamp:  Date.now(),
        });

        // 8. Write pending debit to finance_ledger_entries
        await db.collection("finance_ledger_entries").add({
            venueId,
            type:      "debit",
            source:    "payout_request",
            amount:    amountPaise,
            status:    "pending",
            payoutId:  payoutRef.id,
            createdAt: now,
        });

        // 9. TODO: Call payment provider (Razorpay/Stripe) via API gateway.
        // On success: update payout_requests.status = "processing", write audit log.
        // On failure: update status = "failed", reverse ledger entry, write audit log.
        // This is wired via the webhook handler at /api/webhooks/payout/route.ts
        // For now, the status remains "pending" until the provider callback.

        return NextResponse.json({
            payoutId:   payoutRef.id,
            status:     "pending",
            amountPaise,
            createdAt:  now,
        }, { status: 201 });

    } catch (err: any) {
        console.error("[finance/venue-payouts POST]", err.message);

        // Audit log on error
        try {
            await db.collection("audit_logs").add({
                action:    "payout:error",
                venueId:   ctx.venueId,
                uid:       ctx.uid,
                error:     err.message,
                createdAt: new Date().toISOString(),
                timestamp: Date.now(),
            });
        } catch { /* non-blocking */ }

        return NextResponse.json({ error: "Failed to initiate payout" }, { status: 500 });
    }
}
