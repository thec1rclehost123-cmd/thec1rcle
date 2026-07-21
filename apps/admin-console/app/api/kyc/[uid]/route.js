import { NextResponse } from 'next/server';
import { withAdminAuth } from '@/lib/server/adminMiddleware';
import { getAdminApp } from '@/lib/firebase/admin';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { rateLimit } from '@/lib/server/rateLimit';

function parseStorageUrl(url) {
  if (!url || typeof url !== 'string') return null;

  if (url.startsWith('gs://')) {
    const parts = url.substring(5).split('/');
    const bucketName = parts[0];
    const objectPath = parts.slice(1).join('/');
    return { bucketName, objectPath };
  }

  if (url.startsWith('https://storage.googleapis.com/')) {
    const parts = url.substring(31).split('/');
    const bucketName = parts[0];
    const objectPath = parts.slice(1).join('/').split('?')[0];
    return { bucketName, objectPath };
  }

  if (url.startsWith('https://firebasestorage.googleapis.com/')) {
    const match = url.match(
      /https:\/\/firebasestorage\.googleapis\.com\/v0\/b\/([^/]+)\/o\/([^?#]+)/,
    );
    if (match) {
      const bucketName = match[1];
      const objectPath = decodeURIComponent(match[2]);
      return { bucketName, objectPath };
    }
  }

  return null;
}

async function signStorageUrl(url) {
  if (!url || typeof url !== 'string') return url;
  const parsed = parseStorageUrl(url);
  if (!parsed) return url;

  try {
    const app = getAdminApp();
    const storage = getStorage(app);
    const bucket = storage.bucket();

    if (
      parsed.bucketName === bucket.name &&
      (parsed.objectPath.startsWith('venues/') ||
        parsed.objectPath.startsWith('support-attachments/') ||
        parsed.objectPath.startsWith('hosts/') ||
        parsed.objectPath.startsWith('promoters/') ||
        parsed.objectPath.startsWith('kyc/') ||
        parsed.objectPath.startsWith('kyc-documents/'))
    ) {
      const file = bucket.file(parsed.objectPath);
      const [signedUrl] = await file.getSignedUrl({
        action: 'read',
        expires: Date.now() + 7 * 24 * 60 * 60 * 1000,
      });
      return signedUrl;
    }
  } catch (err) {
    console.error('Failed to sign KYC storage URL:', err);
  }
  return url;
}

async function signObjectGcsUrls(obj) {
  if (!obj) return obj;
  if (typeof obj === 'string') {
    if (
      obj.startsWith('gs://') ||
      obj.startsWith('https://storage.googleapis.com/') ||
      obj.startsWith('https://firebasestorage.googleapis.com/')
    ) {
      return await signStorageUrl(obj);
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return await Promise.all(obj.map((item) => signObjectGcsUrls(item)));
  }
  if (typeof obj === 'object') {
    const res = {};
    for (const [k, v] of Object.entries(obj)) {
      res[k] = await signObjectGcsUrls(v);
    }
    return res;
  }
  return obj;
}

export const dynamic = 'force-dynamic';

const STEP_SEQUENCES = {
  individual: ['kyc_identity', 'bank_setup'],
  business: ['kyc_business', 'kyc_signatory', 'bank_setup'],
};

function deriveKycStatus(stepSequence, stepStatus) {
  const statuses = stepSequence.map((s) => stepStatus[s] || 'not_started');
  if (statuses.every((s) => s === 'not_started')) return 'not_started';
  if (statuses.every((s) => s === 'approved')) return 'fully_verified';
  if (statuses.some((s) => s === 'needs_resubmission')) return 'action_required';
  if (statuses.every((s) => ['submitted', 'under_review', 'approved'].includes(s)))
    return 'fully_submitted';
  if (statuses.some((s) => ['submitted', 'under_review', 'approved'].includes(s)))
    return 'partially_submitted';
  if (statuses.some((s) => s === 'approved')) return 'partially_approved';
  return 'in_progress';
}

// ── GET — admin reads full KYC state for a user ───────────────────────────────

async function getHandler(req, { params }) {
  const { uid } = await params;
  const app = getAdminApp();
  const db = getFirestore(app);

  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const userData = userDoc.data();
  const entityType = userData.onboardingEntityType || 'individual';

  const reqSnap = await db.collection('onboarding_requests').where('uid', '==', uid).get();

  let onboardingData = null;
  let onboardingDocId = null;

  if (!reqSnap.empty) {
    const docs = reqSnap.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
    docs.sort((a, b) => {
      const aTime = a.data.submittedAt?.toDate?.()?.getTime() || 0;
      const bTime = b.data.submittedAt?.toDate?.()?.getTime() || 0;
      return bTime - aTime;
    });
    onboardingData = docs[0].data;
    onboardingDocId = docs[0].id;
  }

  const stepSequence = STEP_SEQUENCES[entityType] ?? STEP_SEQUENCES.individual;

  const kycStepData = onboardingData?.kycStepData || onboardingData?.data?.kycStepData || {};
  const enrichedKycStepData = await signObjectGcsUrls(kycStepData);

  const kycStepStatus = { ...(onboardingData?.kycStepStatus || {}) };
  for (const stepId of stepSequence) {
    if (!kycStepStatus[stepId] && kycStepData[stepId]) {
      kycStepStatus[stepId] = 'submitted';
    }
  }

  return NextResponse.json({
    uid,
    email: userData.email,
    displayName: userData.displayName,
    entityType,
    kycStatus: userData.kycStatus || 'not_started',
    stepSequence,
    kycStepStatus: kycStepStatus,
    kycStepData: enrichedKycStepData || {},
    kycStepAdminNotes: onboardingData?.kycStepAdminNotes || {},
    kycStepResubmissionReason: onboardingData?.kycStepResubmissionReason || {},
    onboardingDocId,
    submittedAt: onboardingData?.submittedAt?.toDate?.() || null,
  });
}

// ── PATCH — admin approves/rejects/requests_resubmission on a step ────────────

async function patchHandler(req, { params }) {
  if (!(await rateLimit(req, 10))) {
    return NextResponse.json({ error: 'Too many requests. Please slow down.' }, { status: 429 });
  }

  const { uid } = await params;
  const body = await req.json();
  const { stepId, action, note, resubmitReason } = body;

  // action: "approve" | "reject" | "request_resubmission" | "mark_under_review"
  if (!stepId || !action) {
    return NextResponse.json({ error: 'stepId and action are required.' }, { status: 400 });
  }

  // 🛡️ Task 4.16: Action-Specific Scope & Role Verification
  const allowedRolesForAction = {
    approve: ['admin', 'super', 'ops'],
    reject: ['admin', 'super', 'ops'],
    request_resubmission: ['admin', 'super', 'ops', 'support'],
    mark_under_review: ['admin', 'super', 'ops', 'support'],
  };

  const adminRole = req.user?.admin_role || 'readonly';
  const allowedRoles = allowedRolesForAction[action];

  if (!allowedRoles) {
    return NextResponse.json({ error: `Unsupported KYC action '${action}'.` }, { status: 400 });
  }

  if (!allowedRoles.includes(adminRole)) {
    return NextResponse.json(
      {
        error: `Forbidden: Admin role '${adminRole}' lacks scope to perform action '${action}' on KYC.`,
      },
      { status: 403 },
    );
  }

  const adminId = req.user.uid;
  const app = getAdminApp();
  const db = getFirestore(app);

  const userDoc = await db.collection('users').doc(uid).get();
  if (!userDoc.exists) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const userData = userDoc.data();
  const entityType = userData.onboardingEntityType || 'individual';
  const stepSequence = STEP_SEQUENCES[entityType] ?? STEP_SEQUENCES.individual;

  if (!stepSequence.includes(stepId)) {
    return NextResponse.json(
      { error: `Invalid step '${stepId}' for entity type '${entityType}'.` },
      { status: 400 },
    );
  }

  const reqSnap = await db.collection('onboarding_requests').where('uid', '==', uid).get();

  if (reqSnap.empty) {
    return NextResponse.json({ error: 'No onboarding request found.' }, { status: 404 });
  }

  let reqDoc = reqSnap.docs[0];
  if (reqSnap.docs.length > 1) {
    const docs = reqSnap.docs.map((doc) => ({ doc, data: doc.data() }));
    docs.sort((a, b) => {
      const aTime = a.data.submittedAt?.toDate?.()?.getTime() || 0;
      const bTime = b.data.submittedAt?.toDate?.()?.getTime() || 0;
      return bTime - aTime;
    });
    reqDoc = docs[0].doc;
  }
  const existingData = reqDoc.data();
  const kycStepData = existingData.kycStepData || existingData.data?.kycStepData || {};
  const kycStepStatus = { ...(existingData.kycStepStatus || {}) };
  for (const s of stepSequence) {
    if (!kycStepStatus[s] && kycStepData[s]) {
      kycStepStatus[s] = 'submitted';
    }
  }

  const ACTION_TO_STATUS = {
    approve: 'approved',
    reject: 'rejected',
    request_resubmission: 'needs_resubmission',
    mark_under_review: 'under_review',
  };

  const newStepStatus = ACTION_TO_STATUS[action];
  if (!newStepStatus) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  kycStepStatus[stepId] = newStepStatus;
  const newKycStatus = deriveKycStatus(stepSequence, kycStepStatus);

  const updatePayload = {
    [`kycStepStatus.${stepId}`]: newStepStatus,
    [`kycStepAdminNotes.${stepId}`]: note || '',
    kycOverallStatus: newKycStatus,
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (action === 'request_resubmission') {
    if (!resubmitReason) {
      return NextResponse.json(
        { error: 'resubmitReason is required when requesting resubmission.' },
        { status: 400 },
      );
    }
    updatePayload[`kycStepResubmissionReason.${stepId}`] = resubmitReason;
  } else {
    updatePayload[`kycStepResubmissionReason.${stepId}`] = FieldValue.delete();
  }

  await reqDoc.ref.update(updatePayload);

  // Denormalize to users/{uid}
  await db.collection('users').doc(uid).update({
    kycStatus: newKycStatus,
    updatedAt: FieldValue.serverTimestamp(),
  });

  // Audit log
  await db.collection('admin_audit_logs').add({
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

export const GET = withAdminAuth(getHandler, 'support');
export const PATCH = withAdminAuth(patchHandler, 'support');
