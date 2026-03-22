import { NextResponse } from "next/server";
import { withAdminAuth } from "@/lib/server/adminMiddleware";
import { getAdminApp } from "@/lib/firebase/admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

export const dynamic = "force-dynamic";

const STEP_SEQUENCES = {
    individual: ["kyc_identity", "bank_setup"],
    business:   ["kyc_business", "kyc_signatory", "bank_setup"],
};

function deriveKycStatus(stepSequence, stepStatus) {
    const statuses = stepSequence.map((s) => stepStatus[s] || "not_started");
    if (statuses.every((s) => s === "not_started")) return "not_started";
    if (statuses.every((s) => s === "approved"))     return "fully_verified";
    if (statuses.some((s) => s === "needs_resubmission")) return "action_required";
    if (statuses.every((s) => ["submitted", "under_review", "approved"].includes(s))) return "fully_submitted";
    if (statuses.some((s) => ["submitted", "under_review", "approved"].includes(s))) return "partially_submitted";
    if (statuses.some((s) => s === "approved"))      return "partially_approved";
    return "in_progress";
}

// ── GET — admin reads full KYC state for a user ───────────────────────────────

async function getHandler(req, { params }) {
    const { uid } = params;
    const app = getAdminApp();
    const db = getFirestore(app);

    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userData = userDoc.data();
    const entityType = userData.onboardingEntityType || "individual";

    const reqSnap = await db
        .collection("onboarding_requests")
        .where("uid", "==", uid)
        .orderBy("submittedAt", "desc")
        .limit(1)
        .get();

    const onboardingData = reqSnap.empty ? null : reqSnap.docs[0].data();
    const onboardingDocId = reqSnap.empty ? null : reqSnap.docs[0].id;

    const stepSequence = STEP_SEQUENCES[entityType] ?? STEP_SEQUENCES.individual;

    return NextResponse.json({
        uid,
        email: userData.email,
        displayName: userData.displayName,
        entityType,
        kycStatus: userData.kycStatus || "not_started",
        stepSequence,
        kycStepStatus:             onboardingData?.kycStepStatus || {},
        kycStepData:               onboardingData?.kycStepData || {},
        kycStepAdminNotes:         onboardingData?.kycStepAdminNotes || {},
        kycStepResubmissionReason: onboardingData?.kycStepResubmissionReason || {},
        onboardingDocId,
        submittedAt: onboardingData?.submittedAt?.toDate?.() || null,
    });
}

// ── PATCH — admin approves/rejects/requests_resubmission on a step ────────────

async function patchHandler(req, { params }) {
    const { uid } = params;
    const body = await req.json();
    const { stepId, action, note, resubmitReason } = body;

    // action: "approve" | "reject" | "request_resubmission" | "mark_under_review"
    if (!stepId || !action) {
        return NextResponse.json({ error: "stepId and action are required." }, { status: 400 });
    }

    const adminId = req.user.uid;
    const app = getAdminApp();
    const db = getFirestore(app);

    const userDoc = await db.collection("users").doc(uid).get();
    if (!userDoc.exists) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userData = userDoc.data();
    const entityType = userData.onboardingEntityType || "individual";
    const stepSequence = STEP_SEQUENCES[entityType] ?? STEP_SEQUENCES.individual;

    if (!stepSequence.includes(stepId)) {
        return NextResponse.json({ error: `Invalid step '${stepId}' for entity type '${entityType}'.` }, { status: 400 });
    }

    const reqSnap = await db
        .collection("onboarding_requests")
        .where("uid", "==", uid)
        .orderBy("submittedAt", "desc")
        .limit(1)
        .get();

    if (reqSnap.empty) {
        return NextResponse.json({ error: "No onboarding request found." }, { status: 404 });
    }

    const reqDoc = reqSnap.docs[0];
    const existingData = reqDoc.data();
    const kycStepStatus = { ...(existingData.kycStepStatus || {}) };

    const ACTION_TO_STATUS = {
        approve:              "approved",
        reject:               "rejected",
        request_resubmission: "needs_resubmission",
        mark_under_review:    "under_review",
    };

    const newStepStatus = ACTION_TO_STATUS[action];
    if (!newStepStatus) {
        return NextResponse.json({ error: "Invalid action. Must be: approve | reject | request_resubmission | mark_under_review" }, { status: 400 });
    }

    kycStepStatus[stepId] = newStepStatus;
    const newKycStatus = deriveKycStatus(stepSequence, kycStepStatus);

    const updatePayload = {
        [`kycStepStatus.${stepId}`]: newStepStatus,
        [`kycStepAdminNotes.${stepId}`]: note || "",
        kycOverallStatus: newKycStatus,
        updatedAt: FieldValue.serverTimestamp(),
    };

    if (action === "request_resubmission") {
        if (!resubmitReason) {
            return NextResponse.json({ error: "resubmitReason is required when requesting resubmission." }, { status: 400 });
        }
        updatePayload[`kycStepResubmissionReason.${stepId}`] = resubmitReason;
    } else {
        updatePayload[`kycStepResubmissionReason.${stepId}`] = FieldValue.delete();
    }

    await reqDoc.ref.update(updatePayload);

    // Denormalize to users/{uid}
    await db.collection("users").doc(uid).update({
        kycStatus: newKycStatus,
        updatedAt: FieldValue.serverTimestamp(),
    });

    // Audit log
    await db.collection("admin_audit_logs").add({
        adminId,
        action: `KYC_STEP_${action.toUpperCase()}`,
        targetUid: uid,
        stepId,
        newStatus: newStepStatus,
        note: note || null,
        resubmitReason: resubmitReason || null,
        timestamp: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ success: true, kycStatus: newKycStatus, stepStatus: newStepStatus });
}

export const GET  = withAdminAuth(getHandler);
export const PATCH = withAdminAuth(patchHandler);
