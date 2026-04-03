import { getAdminDb } from "@/lib/firebase/admin";
import { logger } from "@/lib/server/logger";
import { verifyBankAccountDetails } from "./bankVerification";
import { getPayoutProviderReadiness } from "./providerConfig";
import { provisionRazorpayXPayoutMethod } from "./razorpayXPayouts";
import type { CreatePayoutMethodInput, PartnerPayoutOwnerType, PayoutMethodRecord } from "./types";

const COLLECTION_BY_PARTNER: Record<PartnerPayoutOwnerType, string> = {
    venue: "venue_bank_accounts",
    host: "host_bank_accounts",
    promoter: "promoter_payout_methods",
};

function toIsoDate(value: unknown): string | null {
    if (typeof value === "number") return new Date(value).toISOString();
    if (typeof value === "string" && value) {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
    }
    return null;
}

function mapDocToResponse(doc: FirebaseFirestore.QueryDocumentSnapshot | FirebaseFirestore.DocumentSnapshot) {
    const data = doc.data() as any;
    if (!data) return null;

    return {
        id: doc.id,
        paymentType: data.paymentType || "bank_account",
        bankName: data.paymentType === "debit_card"
            ? (data.cardBrand || "Debit Card")
            : (data.bankName || "Bank Account"),
        last4: data.last4 || "****",
        isDefault: data.isDefault === true,
        accountType: data.accountType || "savings",
        cardHolderName: data.cardHolderName || null,
        expiryMonth: data.expiryMonth || null,
        expiryYear: data.expiryYear || null,
        onboardingStatus: data.onboardingStatus || "draft",
        verificationStatus: data.verificationStatus || "not_started",
        verificationMessage: data.verificationMessage || null,
        provider: data.provider || "razorpayx",
        providerMode: data.providerMode || "unconfigured",
        createdAt: toIsoDate(data.createdAt),
        updatedAt: toIsoDate(data.updatedAt),
    };
}

export async function listPayoutMethods(
    partnerType: PartnerPayoutOwnerType,
    partnerId: string
) {
    const db = getAdminDb();
    const snap = await db.collection(COLLECTION_BY_PARTNER[partnerType])
        .where(`${partnerType}Id`, "==", partnerId)
        .where("removed", "==", false)
        .orderBy("createdAt", "desc")
        .limit(20)
        .get();

    return snap.docs
        .map((doc) => mapDocToResponse(doc))
        .filter(Boolean);
}

export async function createPayoutMethod(input: CreatePayoutMethodInput) {
    const db = getAdminDb();
    const collectionName = COLLECTION_BY_PARTNER[input.partnerType];
    const partnerField = `${input.partnerType}Id`;
    const now = Date.now();

    const existingSnap = await db.collection(collectionName)
        .where(partnerField, "==", input.partnerId)
        .where("removed", "==", false)
        .limit(1)
        .get();
    const isFirst = existingSnap.empty;

    const readiness = getPayoutProviderReadiness();
    const verification = await verifyBankAccountDetails(input);
    const providerProvisioning = await provisionRazorpayXPayoutMethod(input);

    const payload: Omit<PayoutMethodRecord, "id"> & Record<string, unknown> = {
        partnerType: input.partnerType,
        partnerId: input.partnerId,
        ownerUid: input.ownerUid,
        paymentType: input.paymentType,
        accountHolderName: input.paymentType === "bank_account" ? (input.accountHolderName || null) : null,
        bankName: input.paymentType === "bank_account" ? (input.bankName || "Bank Account") : null,
        ifscCode: input.paymentType === "bank_account" ? (input.ifscCode?.toUpperCase() || null) : null,
        accountType: input.accountType || "savings",
        cardHolderName: input.paymentType === "debit_card" ? (input.cardHolderName || null) : null,
        cardBrand: input.paymentType === "debit_card" ? (input.cardBrand || "Debit Card") : null,
        expiryMonth: input.paymentType === "debit_card" ? (input.expiryMonth || null) : null,
        expiryYear: input.paymentType === "debit_card" ? (input.expiryYear || null) : null,
        last4: input.paymentType === "debit_card"
            ? String(input.cardNumber || "").slice(-4)
            : String(input.accountNumber || "").slice(-4),
        isDefault: isFirst,
        provider: "razorpayx",
        providerMode: readiness.mode,
        onboardingStatus: providerProvisioning.onboardingStatus,
        verificationStatus: verification.verificationStatus,
        verificationMessage: verification.verificationMessage || null,
        verificationReference: verification.verificationReference || null,
        providerContactId: providerProvisioning.providerContactId || null,
        providerFundAccountId: providerProvisioning.providerFundAccountId || null,
        providerBeneficiaryId: providerProvisioning.providerBeneficiaryId || null,
        providerPayoutMode: providerProvisioning.providerPayoutMode || null,
        removed: false,
        createdAt: now,
        updatedAt: now,
        addedBy: input.ownerUid,
        [partnerField]: input.partnerId,
        routingNumber: null,
    };

    const ref = await db.collection(collectionName).add(payload);

    logger.info("payments/payoutAccounts", "Payout method created", {
        partnerType: input.partnerType,
        partnerId: input.partnerId,
        paymentType: input.paymentType,
        payoutMethodId: ref.id,
        onboardingStatus: payload.onboardingStatus,
        verificationStatus: payload.verificationStatus,
    });

    return {
        accountId: ref.id,
        isDefault: isFirst,
        onboardingStatus: payload.onboardingStatus,
        verificationStatus: payload.verificationStatus,
    };
}

export async function removePayoutMethod(
    partnerType: PartnerPayoutOwnerType,
    partnerId: string,
    accountId: string,
    uid: string
) {
    const db = getAdminDb();
    const collectionName = COLLECTION_BY_PARTNER[partnerType];
    const partnerField = `${partnerType}Id`;
    const doc = await db.collection(collectionName).doc(accountId).get();
    if (!doc.exists || doc.data()?.[partnerField] !== partnerId) {
        return false;
    }

    await doc.ref.update({
        removed: true,
        removedAt: Date.now(),
        removedBy: uid,
        updatedAt: Date.now(),
    });
    return true;
}
