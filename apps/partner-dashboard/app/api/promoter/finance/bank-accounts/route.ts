import { NextRequest, NextResponse } from "next/server";
import { requirePromoterAccess } from "@/lib/server/promoterAuthMiddleware";
import { fail, ok } from "@/lib/server/apiResponse";
import {
    createPayoutMethod,
    listPayoutMethods,
    removePayoutMethod,
} from "@/lib/server/payments/payoutAccounts";

export async function GET(request: NextRequest) {
    const ctx = await requirePromoterAccess(request);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    try {
        const accounts = await listPayoutMethods("promoter", ctx.promoterId);

        return NextResponse.json({ accounts }, { headers: { "Cache-Control": "private, max-age=60" } });
    } catch {
        return NextResponse.json({ accounts: [] });
    }
}

export async function POST(request: NextRequest) {
    const ctx = await requirePromoterAccess(request);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    try {
        const body = await request.json();
        const {
            paymentType = "bank_account",
            accountHolderName,
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
            partnerType: "promoter",
            partnerId: ctx.promoterId,
            ownerUid: ctx.uid,
            paymentType,
            accountHolderName,
            bankName,
            accountNumber,
            ifscCode,
            accountType: "savings",
            cardHolderName,
            cardBrand,
            cardNumber,
            expiryMonth,
            expiryYear,
        });

        return ok(result);
    } catch {
        return fail("Failed to add payout method");
    }
}

export async function DELETE(request: NextRequest) {
    const ctx = await requirePromoterAccess(request);
    if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get("accountId");
    if (!accountId) return fail("accountId required", 400);

    try {
        const removed = await removePayoutMethod("promoter", ctx.promoterId, accountId, ctx.uid);
        if (!removed) return fail("Not found", 404);
        return ok(null);
    } catch {
        return fail("Failed to remove payout method");
    }
}
