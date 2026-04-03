import { withAuth } from "@/lib/server/withAuth";
import { ok } from "@/lib/server/apiResponse";
import { getPayoutProviderReadiness } from "@/lib/server/payments/providerConfig";

export const GET = withAuth(async () => {
    const readiness = getPayoutProviderReadiness();

    return ok({
        provider: readiness.provider,
        payoutsEnabled: readiness.payoutsEnabled,
        mode: readiness.mode,
        collectionKeysConfigured: readiness.collectionKeysConfigured,
        payoutKeysConfigured: readiness.payoutKeysConfigured,
        payoutWebhookConfigured: readiness.payoutWebhookConfigured,
        verificationConfigured: readiness.verificationConfigured,
        missing: readiness.missing,
        checklist: [
            "Customer collections through Razorpay Payment Gateway",
            "Platform settlement account configured for C1RCLE",
            "Recipient payout provider keys configured for RazorpayX",
            "Bank verification provider configured",
            "Webhook secrets added for payment and payout events",
            "Go-live business rules approved for venue, host, and promoter payouts",
        ],
    });
});
