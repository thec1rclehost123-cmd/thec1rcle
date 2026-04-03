import type { PayoutProviderReadiness } from "./types";

const truthy = new Set(["1", "true", "yes", "on"]);

function isTruthy(value: string | undefined): boolean {
    return truthy.has(String(value || "").trim().toLowerCase());
}

export function getPayoutProviderReadiness(): PayoutProviderReadiness {
    const collectionKeysConfigured = Boolean(
        process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
    );
    const payoutKeysConfigured = Boolean(
        process.env.RAZORPAYX_KEY_ID &&
        process.env.RAZORPAYX_KEY_SECRET &&
        process.env.RAZORPAYX_ACCOUNT_NUMBER
    );
    const payoutWebhookConfigured = Boolean(process.env.RAZORPAYX_WEBHOOK_SECRET);
    const verificationConfigured = Boolean(
        process.env.CASHFREE_CLIENT_ID && process.env.CASHFREE_CLIENT_SECRET
    );

    const missing: string[] = [];
    if (!collectionKeysConfigured) {
        missing.push("RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET");
    }
    if (!payoutKeysConfigured) {
        missing.push("RAZORPAYX_KEY_ID", "RAZORPAYX_KEY_SECRET", "RAZORPAYX_ACCOUNT_NUMBER");
    }
    if (!payoutWebhookConfigured) {
        missing.push("RAZORPAYX_WEBHOOK_SECRET");
    }
    if (!verificationConfigured) {
        missing.push("CASHFREE_CLIENT_ID", "CASHFREE_CLIENT_SECRET");
    }

    const hasAllCoreKeys = collectionKeysConfigured && payoutKeysConfigured && payoutWebhookConfigured;

    return {
        provider: "razorpayx",
        payoutsEnabled: hasAllCoreKeys && isTruthy(process.env.PAYOUTS_ENABLED),
        mode: payoutKeysConfigured
            ? (isTruthy(process.env.PAYOUTS_LIVE_MODE) ? "live" : "sandbox")
            : "unconfigured",
        collectionKeysConfigured,
        payoutKeysConfigured,
        payoutWebhookConfigured,
        verificationConfigured,
        missing,
    };
}
