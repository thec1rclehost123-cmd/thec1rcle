import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/server/auth";
import { getAdminDb } from "@/lib/firebase/admin";
import { FieldValue } from "firebase-admin/firestore";
import { rateLimit } from "@/lib/server/rateLimit";

// ── Step sequence config ──────────────────────────────────────────────────────

const STEP_SEQUENCES: Record<string, string[]> = {
    individual: ["kyc_identity", "bank_setup"],
    business:   ["kyc_business", "kyc_signatory", "bank_setup"],
};

/** Derive the overall kycStatus from per-step statuses. */
function deriveKycStatus(
    stepSequence: string[],
    stepStatus: Record<string, string>
): string {
    const statuses = stepSequence.map((s) => stepStatus[s] || "not_started");
    if (statuses.every((s) => s === "not_started")) return "not_started";
    if (statuses.every((s) => s === "approved"))     return "fully_verified";
    if (statuses.some((s) => s === "needs_resubmission")) return "action_required";
    if (statuses.every((s) => ["submitted", "under_review", "approved"].includes(s))) return "fully_submitted";
    if (statuses.some((s) => ["submitted", "under_review", "approved"].includes(s))) return "partially_submitted";
    if (statuses.some((s) => s === "approved"))      return "partially_approved";
    return "in_progress";
}

// ── GET — return KYC state for the authenticated user ─────────────────────────

export async function GET(req: NextRequest) {
    const decodedToken = await verifyAuth(req);
    if (!decodedToken) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const db = getAdminDb();
    const uid = decodedToken.uid;

    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userData = userDoc.data()!;
    const entityType: string = userData.onboardingEntityType || "individual";
    const kycStatus: string  = userData.kycStatus || "not_started";

    // Load the onboarding request for this user
    const reqSnap = await db
        .collection("onboarding_requests")
        .where("uid", "==", uid)
        .limit(1)
        .get();

    const onboardingData = reqSnap.empty ? null : reqSnap.docs[0].data();

    const stepSequence = STEP_SEQUENCES[entityType] ?? STEP_SEQUENCES.individual;
    const kycStepStatus: Record<string, string>  = onboardingData?.kycStepStatus  || {};
    const kycStepData:   Record<string, unknown> = onboardingData?.kycStepData    || {};
    const kycAdminNotes: Record<string, string>  = onboardingData?.kycStepAdminNotes || {};
    const resubmissionReasons: Record<string, string> = onboardingData?.kycStepResubmissionReason || {};

    return NextResponse.json({
        entityType,
        kycStatus,
        stepSequence,
        kycStepStatus,
        kycStepData,
        kycAdminNotes,
        resubmissionReasons,
    });
}

// ── PATCH — submit or update a KYC step ──────────────────────────────────────

export async function PATCH(req: NextRequest) {
    const allowed = await rateLimit(req, 20, 60);
    if (!allowed) {
        return NextResponse.json({ error: "Too many requests. Please slow down." }, { status: 429 });
    }

    const decodedToken = await verifyAuth(req);
    if (!decodedToken) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const uid = decodedToken.uid;
    const body = await req.json();
    const { stepId, data } = body as { stepId: string; data: Record<string, unknown> };

    if (!stepId || !data) {
        return NextResponse.json({ error: "stepId and data are required." }, { status: 400 });
    }

    const db = getAdminDb();

    // Read entity type from user doc
    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userData = userDoc.data()!;
    const entityType: string = userData.onboardingEntityType || "individual";

    if (!userData.isApproved) {
        return NextResponse.json({ error: "Account not yet approved." }, { status: 403 });
    }

    const stepSequence = STEP_SEQUENCES[entityType] ?? STEP_SEQUENCES.individual;
    if (!stepSequence.includes(stepId)) {
        return NextResponse.json({ error: `Invalid step '${stepId}' for entity type '${entityType}'.` }, { status: 400 });
    }

    // Get the onboarding request doc for this user
    const reqSnap = await db
        .collection("onboarding_requests")
        .where("uid", "==", uid)
        .limit(1)
        .get();

    if (reqSnap.empty) {
        return NextResponse.json({ error: "No onboarding request found." }, { status: 404 });
    }

    const reqDoc = reqSnap.docs[0];
    const existingData = reqDoc.data();
    const kycStepStatus: Record<string, string> = existingData.kycStepStatus || {};

    // Don't allow re-submission of an already-approved step
    if (kycStepStatus[stepId] === "approved") {
        return NextResponse.json({ error: "This step has already been approved." }, { status: 409 });
    }

    // Update the step
    const updatedStepStatus = { ...kycStepStatus, [stepId]: "submitted" };
    const newKycStatus = deriveKycStatus(stepSequence, updatedStepStatus);

    await reqDoc.ref.update({
        [`kycStepData.${stepId}`]: data,
        [`kycStepStatus.${stepId}`]: "submitted",
        [`kycStepResubmissionReason.${stepId}`]: FieldValue.delete(),
        kycOverallStatus: newKycStatus,
        updatedAt: FieldValue.serverTimestamp(),
    });

    // Denormalize to users/{uid}
    await db.collection("users").doc(uid).update({
        kycStatus: newKycStatus,
        updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, kycStatus: newKycStatus, stepStatus: "submitted" });
}
