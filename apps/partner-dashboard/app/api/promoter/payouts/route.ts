import { NextRequest } from "next/server";
import {
    getPromoterBalance,
    requestPayout,
    listPromoterPayouts,
    getPayoutById,
    cancelPayout,
    PAYOUT_STATUS
} from "@/lib/server/payoutStore";
import { withAuth } from "@/lib/server/withAuth";
import { ok, fail } from "@/lib/server/apiResponse";

/**
 * GET /api/promoter/payouts
 * Get promoter's balance and payout history
 */
export const GET = withAuth(async (req: NextRequest) => {
    try {
        const { searchParams } = new URL(req.url);
        const promoterId = searchParams.get("promoterId");
        const payoutId = searchParams.get("payoutId");
        const status = searchParams.get("status");

        if (!promoterId && !payoutId) return fail("promoterId or payoutId is required", 400);

        // Get single payout
        if (payoutId) {
            const payout = await getPayoutById(payoutId);
            if (!payout) return fail("Payout not found", 404);
            return ok({ payout });
        }

        // Get balance and payouts
        const [balance, payouts] = await Promise.all([
            getPromoterBalance(promoterId!),
            listPromoterPayouts(promoterId!, { status: status || undefined })
        ]);

        return ok({ balance, payouts });
    } catch (error: any) {
        console.error("[Payouts API] GET Error:", error);
        return fail("Failed to fetch payout data");
    }
});

/**
 * POST /api/promoter/payouts
 * Request a new payout
 */
export const POST = withAuth(async (req: NextRequest) => {
    try {
        const body = await req.json();
        const { promoterId, amount, paymentMethod, paymentDetails, user } = body;

        if (!promoterId || !amount || !paymentMethod) {
            return fail("promoterId, amount, and paymentMethod are required", 400);
        }

        // Validate payment method
        const validMethods = ["upi", "bank_transfer", "paytm"];
        if (!validMethods.includes(paymentMethod)) {
            return fail(`Invalid payment method. Valid: ${validMethods.join(", ")}`, 400);
        }

        // Validate payment details based on method
        if (paymentMethod === "upi" && !paymentDetails?.upiId) {
            return fail("UPI ID is required for UPI payment", 400);
        }

        if (paymentMethod === "bank_transfer") {
            if (!paymentDetails?.accountNumber || !paymentDetails?.ifscCode) {
                return fail("Account number and IFSC code are required for bank transfer", 400);
            }
        }

        const payout = await requestPayout({
            promoterId,
            amount,
            paymentMethod,
            paymentDetails,
            requestedBy: user || { uid: promoterId }
        });

        return ok({ payout, message: "Payout request submitted successfully" }, undefined, 201);
    } catch (error: any) {
        console.error("[Payouts API] POST Error:", error);
        return fail("Failed to request payout", error.message?.includes("Insufficient") ? 400 : 500);
    }
});

/**
 * DELETE /api/promoter/payouts
 * Cancel a pending payout request
 */
export const DELETE = withAuth(async (req: NextRequest) => {
    try {
        const { searchParams } = new URL(req.url);
        const payoutId = searchParams.get("payoutId");
        const reason = searchParams.get("reason") || "Cancelled by user";
        const uid = searchParams.get("uid");

        if (!payoutId) return fail("payoutId is required", 400);

        const payout = await cancelPayout(payoutId, reason, { uid: uid || "unknown" });

        return ok({ payout, message: "Payout request cancelled" });
    } catch (error: any) {
        console.error("[Payouts API] DELETE Error:", error);
        return fail("Failed to cancel payout", error.message?.includes("only cancel") ? 400 : 500);
    }
});
