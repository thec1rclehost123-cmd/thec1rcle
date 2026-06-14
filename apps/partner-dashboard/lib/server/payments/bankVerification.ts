import { logger } from "@/lib/server/logger";
import type { CreatePayoutMethodInput, PayoutProvisioningResult } from "./types";
import { getPayoutProviderReadiness } from "./providerConfig";

function sanitizeName(value: string | undefined): string {
    return String(value || "").trim();
}

export async function verifyBankAccountDetails(
    input: CreatePayoutMethodInput
): Promise<Pick<PayoutProvisioningResult, "verificationStatus" | "verificationMessage" | "verificationReference">> {
    const readiness = getPayoutProviderReadiness();

    if (input.paymentType !== "bank_account") {
        return {
            verificationStatus: "skipped",
            verificationMessage: "Debit cards are not verified until the payout provider is activated.",
            verificationReference: null,
        };
    }

    if (!readiness.verificationConfigured) {
        return {
            verificationStatus: "manual_review",
            verificationMessage: "Bank verification provider is not configured yet.",
            verificationReference: null,
        };
    }

    const accountHolderName = sanitizeName(input.accountHolderName);
    const ifscCode = sanitizeName(input.ifscCode).toUpperCase();
    const accountNumber = String(input.accountNumber || "").trim();

    if (!accountHolderName || !ifscCode || !accountNumber) {
        return {
            verificationStatus: "failed",
            verificationMessage: "Account holder name, IFSC code, and account number are required.",
            verificationReference: null,
        };
    }

    logger.info("payments/bankVerification", "Verification deferred until live provider credentials are added", {
        partnerType: input.partnerType,
        partnerId: input.partnerId,
        ifscCode,
    });

    return {
        verificationStatus: "pending",
        verificationMessage: "Verification provider configured. Activate the live verification call after secrets are added.",
        verificationReference: `verify_pending_${input.partnerType}_${input.partnerId}`,
    };
}
