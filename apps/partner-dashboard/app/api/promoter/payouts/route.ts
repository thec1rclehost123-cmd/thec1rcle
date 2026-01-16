import { NextRequest, NextResponse } from "next/server";
import {
    getPromoterBalance,
    requestPayout,
    listPromoterPayouts,
    getPayoutById,
    cancelPayout,
    PAYOUT_STATUS
} from "@/lib/server/payoutStore";

/**
 * GET /api/promoter/payouts
 * Get promoter's balance and payout history
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const promoterId = searchParams.get("promoterId");
        const payoutId = searchParams.get("payoutId");
        const status = searchParams.get("status");

        if (!promoterId && !payoutId) {
            return NextResponse.json(
                { error: "promoterId or payoutId is required" },
                { status: 400 }
            );
        }

        // Get single payout
        if (payoutId) {
            const payout = await getPayoutById(payoutId);
            if (!payout) {
                return NextResponse.json(
                    { error: "Payout not found" },
                    { status: 404 }
                );
            }
            return NextResponse.json({ payout });
        }

        // Get balance and payouts
        const [balance, payouts] = await Promise.all([
            getPromoterBalance(promoterId!),
            listPromoterPayouts(promoterId!, { status: status || undefined })
        ]);

        return NextResponse.json({ balance, payouts });
    } catch (error: any) {
        console.error("[Payouts API] GET Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch payout data" },
            { status: 500 }
        );
    }
}

/**
 * POST /api/promoter/payouts
 * Request a new payout
 */
export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { promoterId, amount, paymentMethod, paymentDetails, user } = body;

        if (!promoterId || !amount || !paymentMethod) {
            return NextResponse.json(
                { error: "promoterId, amount, and paymentMethod are required" },
                { status: 400 }
            );
        }

        // Validate payment method
        const validMethods = ["upi", "bank_transfer", "paytm"];
        if (!validMethods.includes(paymentMethod)) {
            return NextResponse.json(
                { error: `Invalid payment method. Valid: ${validMethods.join(", ")}` },
                { status: 400 }
            );
        }

        // Validate payment details based on method
        if (paymentMethod === "upi" && !paymentDetails?.upiId) {
            return NextResponse.json(
                { error: "UPI ID is required for UPI payment" },
                { status: 400 }
            );
        }

        if (paymentMethod === "bank_transfer") {
            if (!paymentDetails?.accountNumber || !paymentDetails?.ifscCode) {
                return NextResponse.json(
                    { error: "Account number and IFSC code are required for bank transfer" },
                    { status: 400 }
                );
            }
        }

        const payout = await requestPayout({
            promoterId,
            amount,
            paymentMethod,
            paymentDetails,
            requestedBy: user || { uid: promoterId }
        });

        return NextResponse.json({
            success: true,
            payout,
            message: "Payout request submitted successfully"
        }, { status: 201 });
    } catch (error: any) {
        console.error("[Payouts API] POST Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to request payout" },
            { status: error.message?.includes("Insufficient") ? 400 : 500 }
        );
    }
}

/**
 * DELETE /api/promoter/payouts
 * Cancel a pending payout request
 */
export async function DELETE(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const payoutId = searchParams.get("payoutId");
        const reason = searchParams.get("reason") || "Cancelled by user";
        const uid = searchParams.get("uid");

        if (!payoutId) {
            return NextResponse.json(
                { error: "payoutId is required" },
                { status: 400 }
            );
        }

        const payout = await cancelPayout(payoutId, reason, { uid: uid || "unknown" });

        return NextResponse.json({
            success: true,
            payout,
            message: "Payout request cancelled"
        });
    } catch (error: any) {
        console.error("[Payouts API] DELETE Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to cancel payout" },
            { status: error.message?.includes("only cancel") ? 400 : 500 }
        );
    }
}
