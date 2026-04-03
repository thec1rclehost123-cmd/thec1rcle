/**
 * GET  /api/venue/crm/customers?venueId=
 * POST /api/venue/crm/customers?venueId=
 *
 * Manages manually-added CRM customers stored under:
 *   venues/{venueId}/crm_customers/{customerId}
 *
 * Auth: requireVenueAccess (no specific staff action — venue membership required)
 */

import { NextResponse } from "next/server";
import { requireVenueAccess, applyPIIMask } from "@/lib/rbac/staffProfileEnforcer";
import { getAdminDb, isFirebaseConfigured } from "@/lib/firebase/admin";
import { verifyAuth } from "@/lib/server/auth";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ManualCustomer {
    id: string;
    name: string;
    email: string;
    phone: string;
    dob: string;           // YYYY-MM-DD
    eventAppeared: string;
    createdAt: string;     // ISO
    createdByUid: string;
    createdByName: string;
    marketingConsent: {
        allowPlatformMessages: boolean;
        allowDirectContactShare: boolean;
        consentStatement: string | null;
        recordedAt: string;
        recordedByUid: string;
    };
}

// ── Validation helpers ────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// DEV_SEED removed — never return fake data in any environment.

// ── GET — list all manual customers for this venue ────────────────────────────

export async function GET(request: Request) {
    try {
        const ctx = await requireVenueAccess(request);
        if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
        const { venueId, piiPolicy } = ctx;

        if (!isFirebaseConfigured()) {
            return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
        }

        const db = getAdminDb();

        const snap = await db
            .collection("venues")
            .doc(venueId)
            .collection("crm_customers")
            .orderBy("createdAt", "desc")
            .limit(500)
            .get();

        const customers: ManualCustomer[] = snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<ManualCustomer, "id">),
        }));

        const masked = customers.map(c => applyPIIMask(c, piiPolicy));

        return NextResponse.json(
            { customers: masked, total: masked.length },
            { headers: { "Cache-Control": "private, no-store" } }
        );
    } catch (err: any) {
        console.error("[crm/customers GET]", err.code ?? "", err.message);
        return NextResponse.json({ error: err.message ?? "Internal server error" }, { status: 500 });
    }
}

// ── POST — add a manual customer ──────────────────────────────────────────────

export async function POST(request: Request) {
    try {
        const ctx = await requireVenueAccess(request);
        if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
        const { venueId } = ctx;

        const user = await verifyAuth(request);
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json().catch(() => null);
        if (!body) {
            return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
        }

        // ── Validation ────────────────────────────────────────────────────────
        const {
            name,
            email,
            phone,
            dob,
            eventAppeared,
            allowPlatformMessages,
            allowDirectContactShare,
            consentStatement,
        } = body as Record<string, string | boolean>;

        if (!name?.trim())         return NextResponse.json({ error: "Name is required" },           { status: 422 });
        if (!email?.trim())        return NextResponse.json({ error: "Email is required" },          { status: 422 });
        if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Invalid email address" },     { status: 422 });
        if (!phone?.trim())        return NextResponse.json({ error: "Phone number is required" },   { status: 422 });
        if (!dob?.trim())          return NextResponse.json({ error: "Date of birth is required" },  { status: 422 });

        const platformMessagesEnabled = allowPlatformMessages !== false;
        const directContactShareEnabled = allowDirectContactShare === true;
        const normalizedConsentStatement = String(consentStatement || "").trim();

        if (directContactShareEnabled && !normalizedConsentStatement) {
            return NextResponse.json(
                { error: "A consent statement is required before enabling direct contact sharing" },
                { status: 422 }
            );
        }

        const now = new Date().toISOString();

        if (!isFirebaseConfigured()) {
            return NextResponse.json({ error: "Service unavailable" }, { status: 503 });
        }

        const db = getAdminDb();

        // ── Check for duplicate email within this venue ───────────────────────
        const existing = await db
            .collection("venues")
            .doc(venueId)
            .collection("crm_customers")
            .where("email", "==", email.trim().toLowerCase())
            .limit(1)
            .get();

        if (!existing.empty) {
            return NextResponse.json(
                { error: "A customer with this email already exists" },
                { status: 409 }
            );
        }

        // ── Write document ────────────────────────────────────────────────────
        const docRef = db
            .collection("venues")
            .doc(venueId)
            .collection("crm_customers")
            .doc();

        const payload = {
            name:           name.trim(),
            email:          email.trim().toLowerCase(),
            phone:          phone.trim(),
            dob:            dob.trim(),
            eventAppeared:  (eventAppeared ?? "").trim(),
            createdAt:      now,
            createdByUid:   user.uid,
            createdByName:  (user as any).name ?? "Operator",
        };
        const marketingConsent = {
            allowPlatformMessages: platformMessagesEnabled,
            allowDirectContactShare: directContactShareEnabled,
            consentStatement: normalizedConsentStatement || null,
            recordedAt: now,
            recordedByUid: user.uid,
        };

        await Promise.all([
            docRef.set({
                ...payload,
                marketingConsent,
            }),
            db.collection("venues")
                .doc(venueId)
                .collection("marketing_consent_logs")
                .add({
                    customerId: docRef.id,
                    channel: "crm_manual_entry",
                    venueId,
                    email: payload.email,
                    phone: payload.phone,
                    ...marketingConsent,
                    createdAt: now,
                    createdByName: (user as any).name ?? "Operator",
                }),
        ]);

        return NextResponse.json(
            { customer: { id: docRef.id, ...payload, marketingConsent } },
            { status: 201 }
        );
    } catch (err: any) {
        console.error("[crm/customers POST]", err.code ?? "", err.message);
        return NextResponse.json({ error: err.message ?? "Internal server error" }, { status: 500 });
    }
}
