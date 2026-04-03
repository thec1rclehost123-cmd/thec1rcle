import { NextRequest, NextResponse } from "next/server";
import { requirePromoterAccess } from "@/lib/server/promoterAuthMiddleware";
import { ok, fail } from "@/lib/server/apiResponse";
import { getAdminDb } from "@/lib/firebase/admin";
import { getPromoterFinanceSnapshot } from "@/lib/server/promoterFinanceStore";
import { randomUUID } from "node:crypto";

/**
 * GET /api/promoter/payouts
 * Get promoter's balance and payout history.
 * promoterId is resolved from RBAC context — never trusted from client.
 */
export async function GET(req: NextRequest) {
    const ctx = await requirePromoterAccess(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    try {
        const { searchParams } = new URL(req.url);
        const payoutId   = searchParams.get("payoutId");
        const status     = searchParams.get("status");
        const promoterId = ctx.promoterId;
        const snapshot = await getPromoterFinanceSnapshot(promoterId);

        if (payoutId) {
            const payout = snapshot.payouts.find((entry) => entry.id === payoutId) || null;
            if (!payout) return fail("Payout not found", 404);
            return ok({ payout });
        }

        const payouts = status
            ? snapshot.payouts.filter((entry) => entry.status === status.toLowerCase())
            : snapshot.payouts;

        return ok({ balance: snapshot.balance, payouts });
    } catch (error: any) {
        console.error("[Payouts API] GET Error:", error);
        return fail("Failed to fetch payout data");
    }
}

/**
 * POST /api/promoter/payouts
 * Request a new payout.
 * promoterId resolved from RBAC — not accepted from request body.
 */
export async function POST(req: NextRequest) {
    const ctx = await requirePromoterAccess(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    try {
        const body = await req.json();
        const { amount, paymentMethod, paymentDetails } = body;
        const promoterId = ctx.promoterId;
        const uid        = ctx.uid;
        const payoutAmount = Number(amount || 0);

        if (!payoutAmount || !paymentMethod) {
            return fail("amount and paymentMethod are required", 400);
        }

        const validMethods = ["upi", "bank_transfer", "paytm"];
        if (!validMethods.includes(paymentMethod)) {
            return fail(`Invalid payment method. Valid: ${validMethods.join(", ")}`, 400);
        }

        if (paymentMethod === "upi" && !paymentDetails?.upiId) {
            return fail("UPI ID is required for UPI payment", 400);
        }

        if (paymentMethod === "bank_transfer") {
            if (!paymentDetails?.accountNumber || !paymentDetails?.ifscCode) {
                return fail("Account number and IFSC code are required for bank transfer", 400);
            }
        }

        const snapshot = await getPromoterFinanceSnapshot(promoterId);
        if (payoutAmount > snapshot.balance.available) {
            return fail(`Insufficient balance. Available: ₹${snapshot.balance.available}`, 400);
        }

        if (payoutAmount < 100) {
            return fail("Minimum payout amount is ₹100", 400);
        }

        const payoutId = `REQ-${randomUUID().substring(0, 8).toUpperCase()}`;
        const payout = {
            id: payoutId,
            partnerId: promoterId,
            promoterId,
            partnerType: "promoter",
            amount: payoutAmount,
            paymentMethod,
            paymentDetails,
            status: "pending",
            requestedAt: new Date().toISOString(),
            createdAt: new Date().toISOString(),
            requestedBy: uid,
            last4: paymentMethod === "bank_transfer" ? String(paymentDetails.accountNumber).slice(-4) : null,
            bankName: paymentMethod === "bank_transfer" ? "Bank Account" : paymentMethod.toUpperCase(),
        };

        await getAdminDb().collection("payouts").doc(payoutId).set(payout);

        return ok({ payout, message: "Payout request submitted successfully" }, undefined, 201);
    } catch (error: any) {
        console.error("[Payouts API] POST Error:", error);
        return fail("Failed to request payout", error.message?.includes("Insufficient") ? 400 : 500);
    }
}

/**
 * DELETE /api/promoter/payouts?payoutId=
 * Cancel a pending payout request.
 * Only the owning promoter can cancel their own payouts.
 */
export async function DELETE(req: NextRequest) {
    const ctx = await requirePromoterAccess(req);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    try {
        const { searchParams } = new URL(req.url);
        const payoutId = searchParams.get("payoutId");
        const reason   = searchParams.get("reason") || "Cancelled by user";

        if (!payoutId) return fail("payoutId is required", 400);
        const db = getAdminDb();
        const ref = db.collection("payouts").doc(payoutId);
        const snap = await ref.get();
        if (!snap.exists) return fail("Payout not found", 404);

        const data = snap.data() || {};
        const ownerId = data.partnerId || data.promoterId;
        if (ownerId !== ctx.promoterId) return fail("Forbidden", 403);
        if (String(data.status || "").toLowerCase() !== "pending") {
            return fail("Only pending payouts can be cancelled", 400);
        }

        await ref.update({
            status: "cancelled",
            cancelReason: reason,
            updatedAt: new Date().toISOString(),
            cancelledBy: ctx.uid,
        });

        return ok({ payout: { id: payoutId, ...data, status: "cancelled" }, message: "Payout request cancelled" });
    } catch (error: any) {
        console.error("[Payouts API] DELETE Error:", error);
        return fail("Failed to cancel payout", error.message?.includes("only cancel") ? 400 : 500);
    }
}
