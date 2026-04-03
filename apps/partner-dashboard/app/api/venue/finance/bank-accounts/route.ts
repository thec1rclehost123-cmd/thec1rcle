import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/server/withAuth";
import { fail, ok } from "@/lib/server/apiResponse";
import { logger } from "@/lib/server/logger";
import {
    createPayoutMethod,
    listPayoutMethods,
    removePayoutMethod,
} from "@/lib/server/payments/payoutAccounts";

/**
 * GET    /api/venue/finance/bank-accounts?venueId=  — list linked bank accounts
 * POST   /api/venue/finance/bank-accounts            — add a bank account
 * DELETE /api/venue/finance/bank-accounts?venueId=&accountId= — remove
 */
export async function GET(request: NextRequest) {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(request.url);
    const venueId = searchParams.get("venueId");
    if (!venueId) return fail("Missing venueId", 400);

    try {
        const accounts = await listPayoutMethods("venue", venueId);

        return NextResponse.json({ accounts }, {
            headers: { "Cache-Control": "private, max-age=60" },
        });
    } catch (err: any) {
        logger.error("venue/finance/bank-accounts", "GET failed", { error: err.message });
        return NextResponse.json({ accounts: [] });
    }
}

export async function POST(request: NextRequest) {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { uid } = auth as any;

    try {
        const body = await request.json();
        const {
            venueId,
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
        if (!venueId) return fail("Missing venueId", 400);
        if (paymentType === "bank_account" && (!accountHolderName || !accountNumber)) {
            return fail("accountHolderName and accountNumber are required", 422);
        }
        if (paymentType === "debit_card" && (!cardHolderName || !cardNumber || !expiryMonth || !expiryYear)) {
            return fail("cardHolderName, cardNumber, expiryMonth, and expiryYear are required", 422);
        }

        const result = await createPayoutMethod({
            partnerType: "venue",
            partnerId: venueId,
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
        logger.error("venue/finance/bank-accounts", "POST failed", { error: err.message });
        return fail("Failed to add bank account");
    }
}

export async function DELETE(request: NextRequest) {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) return auth;
    const { uid } = auth as any;

    const { searchParams } = new URL(request.url);
    const venueId   = searchParams.get("venueId");
    const accountId = searchParams.get("accountId");
    if (!venueId || !accountId) return fail("venueId and accountId required", 400);

    try {
        const removed = await removePayoutMethod("venue", venueId, accountId, uid);
        if (!removed) return fail("Not found", 404);
        return ok(null);
    } catch (err: any) {
        logger.error("venue/finance/bank-accounts", "DELETE failed", { error: err.message });
        return fail("Failed to remove bank account");
    }
}
