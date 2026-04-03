import { NextRequest, NextResponse } from "next/server";
import { requireHostAccess } from "@/lib/server/hostAuthMiddleware";
import { fail, ok } from "@/lib/server/apiResponse";
import { logger } from "@/lib/server/logger";
import {
    createPayoutMethod,
    listPayoutMethods,
    removePayoutMethod,
} from "@/lib/server/payments/payoutAccounts";

/**
 * GET  /api/host/finance/bank-accounts?hostId=  — list linked bank accounts
 * POST /api/host/finance/bank-accounts          — add a bank account
 * DELETE /api/host/finance/bank-accounts?accountId= — remove
 *
 * All mutations require VIEW_FINANCIALS (read) or MANAGE_EVENTS (writes, scoped to OWNER).
 */
export async function GET(request: NextRequest) {
    const ctx = await requireHostAccess(request, "VIEW_FINANCIALS");
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const { hostId } = ctx;

    try {
        const accounts = await listPayoutMethods("host", hostId);

        return NextResponse.json({ accounts }, {
            headers: { "Cache-Control": "private, max-age=60" },
        });
    } catch (err: any) {
        logger.error("host/finance/bank-accounts", "GET failed", { error: err.message });
        return NextResponse.json({ accounts: [] });
    }
}

export async function POST(request: NextRequest) {
    const ctx = await requireHostAccess(request, "MANAGE_EVENTS");
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const { uid, hostId } = ctx;

    try {
        const body = await request.json();
        const {
            paymentType = "bank_account",
            accountHolderName,
            routingNumber,
            accountNumber,
            ifscCode,
            bankName,
            cardHolderName,
            cardBrand,
            cardNumber,
            expiryMonth,
            expiryYear,
        } = body;
        if (paymentType === "bank_account" && (!accountHolderName || !accountNumber)) {
            return fail("accountHolderName and accountNumber are required", 422);
        }
        if (paymentType === "debit_card" && (!cardHolderName || !cardNumber || !expiryMonth || !expiryYear)) {
            return fail("cardHolderName, cardNumber, expiryMonth, and expiryYear are required", 422);
        }

        const result = await createPayoutMethod({
            partnerType: "host",
            partnerId: hostId,
            ownerUid: uid,
            paymentType,
            accountHolderName,
            bankName,
            accountNumber,
            ifscCode,
            accountType: body.accountType || "savings",
            cardHolderName,
            cardBrand,
            cardNumber,
            expiryMonth,
            expiryYear,
        });

        return ok(result);
    } catch (err: any) {
        logger.error("host/finance/bank-accounts", "POST failed", { error: err.message });
        return fail("Failed to add bank account");
    }
}

export async function DELETE(request: NextRequest) {
    const ctx = await requireHostAccess(request, "MANAGE_EVENTS");
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    const { uid, hostId } = ctx;

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    if (!accountId) return fail("accountId required", 400);

    try {
        const removed = await removePayoutMethod("host", hostId, accountId, uid);
        if (!removed) return fail("Not found", 404);
        return ok(null);
    } catch (err: any) {
        logger.error("host/finance/bank-accounts", "DELETE failed", { error: err.message });
        return fail("Failed to remove bank account");
    }
}
