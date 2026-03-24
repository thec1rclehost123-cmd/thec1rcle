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
}

// ── Validation helpers ────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Dev seed ──────────────────────────────────────────────────────────────────

const DEV_SEED: ManualCustomer[] = [
    { id: "m1", name: "Tanvi Desai",    email: "tanvi.desai@gmail.com",    phone: "+91 90001 11111", dob: "2002-01-09", eventAppeared: "Neon Nights Vol.3",  createdAt: "2025-12-20T18:00:00Z", createdByUid: "owner", createdByName: "Venue Owner" },
    { id: "m2", name: "Nikhil Bose",    email: "nikhil.bose@icloud.com",   phone: "+91 90002 22222", dob: "1990-12-25", eventAppeared: "Saturday Circuit",   createdAt: "2025-12-21T17:30:00Z", createdByUid: "owner", createdByName: "Venue Owner" },
    { id: "m3", name: "Aisha Khan",     email: "aisha.khan@gmail.com",     phone: "+91 90003 33333", dob: "1999-04-07", eventAppeared: "New Year Bash 2026", createdAt: "2025-12-22T10:00:00Z", createdByUid: "owner", createdByName: "Venue Owner" },
];

// ── GET — list all manual customers for this venue ────────────────────────────

export async function GET(request: Request) {
    try {
        const ctx = await requireVenueAccess(request);
        if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
        const { venueId, piiPolicy } = ctx;

        if (!isFirebaseConfigured()) {
            const masked = DEV_SEED.map(c => applyPIIMask(c, piiPolicy));
            return NextResponse.json({ customers: masked, total: masked.length });
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
        const { name, email, phone, dob, eventAppeared } = body as Record<string, string>;

        if (!name?.trim())         return NextResponse.json({ error: "Name is required" },           { status: 422 });
        if (!email?.trim())        return NextResponse.json({ error: "Email is required" },          { status: 422 });
        if (!EMAIL_RE.test(email)) return NextResponse.json({ error: "Invalid email address" },     { status: 422 });
        if (!phone?.trim())        return NextResponse.json({ error: "Phone number is required" },   { status: 422 });
        if (!dob?.trim())          return NextResponse.json({ error: "Date of birth is required" },  { status: 422 });

        const now = new Date().toISOString();

        // ── Dev fallback: just echo the payload ───────────────────────────────
        if (!isFirebaseConfigured()) {
            const mock: ManualCustomer = {
                id:             `mock-${Date.now()}`,
                name:           name.trim(),
                email:          email.trim().toLowerCase(),
                phone:          phone.trim(),
                dob:            dob.trim(),
                eventAppeared:  (eventAppeared ?? "").trim(),
                createdAt:      now,
                createdByUid:   user.uid,
                createdByName:  (user as any).name ?? "Operator",
            };
            return NextResponse.json({ customer: mock }, { status: 201 });
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

        const payload: Omit<ManualCustomer, "id"> = {
            name:           name.trim(),
            email:          email.trim().toLowerCase(),
            phone:          phone.trim(),
            dob:            dob.trim(),
            eventAppeared:  (eventAppeared ?? "").trim(),
            createdAt:      now,
            createdByUid:   user.uid,
            createdByName:  (user as any).name ?? "Operator",
        };

        await docRef.set(payload);

        return NextResponse.json(
            { customer: { id: docRef.id, ...payload } },
            { status: 201 }
        );
    } catch (err: any) {
        console.error("[crm/customers POST]", err.code ?? "", err.message);
        return NextResponse.json({ error: err.message ?? "Internal server error" }, { status: 500 });
    }
}
