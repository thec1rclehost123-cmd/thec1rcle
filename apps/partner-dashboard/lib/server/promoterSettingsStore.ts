/**
 * Promoter Settings Store — server-side Firestore operations
 *
 * Collections:
 *   promoters/{promoterId}                    identity fields
 *   promoter_verification/{promoterId}        KYC verification state
 *   promoter_payout_accounts/{promoterId}     bank / UPI payout config
 *   promoter_preferences/{promoterId}         notifications + operational defaults
 *   audit_logs/{id}                           write-only audit trail
 */

import { randomUUID } from 'node:crypto';
import { getAdminDb, isFirebaseConfigured } from '../firebase/admin';

// ── Types ─────────────────────────────────────────────────────────────────────

export type VerificationStatus = 'UNVERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED';

export interface PromoterIdentity {
  promoterId: string;
  legalName: string;
  brandName: string;
  phone: string;
  city: string;
  logoUrl: string | null;
  updatedAt: string;
}

export interface PromoterVerification {
  promoterId: string;
  status: VerificationStatus;
  govDocUrl: string | null;
  selfieUrl: string | null;
  rejectionReason: string | null;
  submittedAt: string | null;
  updatedAt: string;
}

export interface PromoterPayoutAccount {
  promoterId: string;
  bankName: string;
  accountNumber: string;
  ifsc: string;
  upiId: string;
  threshold: number;
  holdUntil: string | null;
  updatedAt: string;
}

export interface NotificationPrefs {
  notifyNewSale: boolean;
  notifyCheckIn: boolean;
  notifyPayout: boolean;
  notifyPartnership: boolean;
  notifyWeeklyReport: boolean;
  emailDigest: boolean;
}

export interface OperationalDefaults {
  campaignPrefix: string;
  timezone: string;
  autoGenerateShortlinks: boolean;
}

export interface SecurityPrefs {
  twoFaEnabled: boolean;
  twoFaFlaggedAt: string | null;
}

export interface PromoterPreferences {
  promoterId: string;
  notifications: NotificationPrefs;
  operationalDefaults: OperationalDefaults;
  security: SecurityPrefs;
  updatedAt: string;
}

export interface PromoterSettings {
  identity: PromoterIdentity | null;
  verification: PromoterVerification | null;
  payout: PromoterPayoutAccount | null;
  preferences: PromoterPreferences | null;
}

// ── Fallback store (dev without Firebase) ────────────────────────────────────

const _identity = new Map<string, PromoterIdentity>();
const _verification = new Map<string, PromoterVerification>();
const _payout = new Map<string, PromoterPayoutAccount>();
const _prefs = new Map<string, PromoterPreferences>();

// ── Defaults ─────────────────────────────────────────────────────────────────

function defaultNotifications(): NotificationPrefs {
  return {
    notifyNewSale: true,
    notifyCheckIn: true,
    notifyPayout: true,
    notifyPartnership: true,
    notifyWeeklyReport: true,
    emailDigest: false,
  };
}

function defaultOperationalDefaults(): OperationalDefaults {
  return {
    campaignPrefix: 'IG_',
    timezone: 'Asia/Kolkata',
    autoGenerateShortlinks: false,
  };
}

function defaultSecurityPrefs(): SecurityPrefs {
  return { twoFaEnabled: false, twoFaFlaggedAt: null };
}

// ── Audit helper ─────────────────────────────────────────────────────────────

async function writeAudit(entry: {
  action: string;
  targetId: string;
  uid: string;
  diff?: Record<string, unknown>;
  ip?: string;
}) {
  if (!isFirebaseConfigured()) return;
  const id = randomUUID();
  await getAdminDb()
    .collection('audit_logs')
    .doc(id)
    .set({ ...entry, id, createdAt: new Date().toISOString() });
}

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getPromoterSettings(promoterId: string): Promise<PromoterSettings> {
  if (!isFirebaseConfigured()) {
    return {
      identity: _identity.get(promoterId) ?? null,
      verification: _verification.get(promoterId) ?? null,
      payout: _payout.get(promoterId) ?? null,
      preferences: _prefs.get(promoterId) ?? null,
    };
  }

  const db = getAdminDb();
  const [identitySnap, verificationSnap, payoutSnap, prefsSnap] = await Promise.all([
    db.collection('promoters').doc(promoterId).get(),
    db.collection('promoter_verification').doc(promoterId).get(),
    db.collection('promoter_payout_accounts').doc(promoterId).get(),
    db.collection('promoter_preferences').doc(promoterId).get(),
  ]);

  return {
    identity: identitySnap.exists ? (identitySnap.data() as PromoterIdentity) : null,
    verification: verificationSnap.exists
      ? (verificationSnap.data() as PromoterVerification)
      : null,
    payout: payoutSnap.exists ? (payoutSnap.data() as PromoterPayoutAccount) : null,
    preferences: prefsSnap.exists ? (prefsSnap.data() as PromoterPreferences) : null,
  };
}

// ── Identity ──────────────────────────────────────────────────────────────────

export async function updateIdentity(
  promoterId: string,
  fields: Partial<Pick<PromoterIdentity, 'legalName' | 'brandName' | 'phone' | 'city' | 'logoUrl'>>,
  actor: { uid: string },
): Promise<PromoterIdentity> {
  const now = new Date().toISOString();

  if (!isFirebaseConfigured()) {
    const existing = _identity.get(promoterId) ?? {
      promoterId,
      legalName: '',
      brandName: '',
      phone: '',
      city: '',
      logoUrl: null,
      updatedAt: now,
    };
    const updated = { ...existing, ...fields, promoterId, updatedAt: now };
    _identity.set(promoterId, updated);
    return updated;
  }

  const db = getAdminDb();

  // Brand name uniqueness check (only if brandName is being changed)
  if (fields.brandName) {
    const existing = await db
      .collection('promoters')
      .where('brandName', '==', fields.brandName)
      .limit(2)
      .get();
    const conflict = existing.docs.find((d: any) => d.id !== promoterId);
    if (conflict) {
      throw new Error('BRAND_NAME_TAKEN');
    }
  }

  const update = { ...fields, promoterId, updatedAt: now };
  await db.collection('promoters').doc(promoterId).set(update, { merge: true });

  await writeAudit({
    action: 'PROMOTER_IDENTITY_UPDATED',
    targetId: promoterId,
    uid: actor.uid,
    diff: fields as Record<string, unknown>,
  });

  const snap = await db.collection('promoters').doc(promoterId).get();
  return snap.data() as PromoterIdentity;
}

// ── Payout ────────────────────────────────────────────────────────────────────

export async function upsertPayoutAccount(
  promoterId: string,
  fields: Partial<
    Pick<PromoterPayoutAccount, 'bankName' | 'accountNumber' | 'ifsc' | 'upiId' | 'threshold'>
  >,
  actor: { uid: string },
  accountNumberChanged: boolean,
): Promise<PromoterPayoutAccount> {
  const now = new Date().toISOString();
  const holdUntil = accountNumberChanged
    ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    : null;

  if (!isFirebaseConfigured()) {
    const existing = _payout.get(promoterId) ?? {
      promoterId,
      bankName: '',
      accountNumber: '',
      ifsc: '',
      upiId: '',
      threshold: 500,
      holdUntil: null,
      updatedAt: now,
    };
    const updated = { ...existing, ...fields, promoterId, holdUntil, updatedAt: now };
    _payout.set(promoterId, updated);
    return updated;
  }

  const db = getAdminDb();
  const update: Partial<PromoterPayoutAccount> = {
    ...fields,
    promoterId,
    updatedAt: now,
    ...(accountNumberChanged ? { holdUntil } : {}),
  };
  await db.collection('promoter_payout_accounts').doc(promoterId).set(update, { merge: true });

  await writeAudit({
    action: 'PROMOTER_PAYOUT_UPDATED',
    targetId: promoterId,
    uid: actor.uid,
    diff: { ...fields, accountNumberChanged } as Record<string, unknown>,
  });

  const snap = await db.collection('promoter_payout_accounts').doc(promoterId).get();
  return snap.data() as PromoterPayoutAccount;
}

// ── Preferences / Notifications ───────────────────────────────────────────────

export async function patchPreferences(
  promoterId: string,
  patch: {
    notifications?: Partial<NotificationPrefs>;
    operationalDefaults?: Partial<OperationalDefaults>;
    security?: Partial<SecurityPrefs>;
  },
): Promise<PromoterPreferences> {
  const now = new Date().toISOString();

  if (!isFirebaseConfigured()) {
    const existing = _prefs.get(promoterId) ?? {
      promoterId,
      notifications: defaultNotifications(),
      operationalDefaults: defaultOperationalDefaults(),
      security: defaultSecurityPrefs(),
      updatedAt: now,
    };
    const updated: PromoterPreferences = {
      ...existing,
      notifications: { ...existing.notifications, ...(patch.notifications ?? {}) },
      operationalDefaults: {
        ...existing.operationalDefaults,
        ...(patch.operationalDefaults ?? {}),
      },
      security: { ...existing.security, ...(patch.security ?? {}) },
      updatedAt: now,
    };
    _prefs.set(promoterId, updated);
    return updated;
  }

  const db = getAdminDb();
  const snap = await db.collection('promoter_preferences').doc(promoterId).get();
  const existing: PromoterPreferences = snap.exists
    ? (snap.data() as PromoterPreferences)
    : {
        promoterId,
        notifications: defaultNotifications(),
        operationalDefaults: defaultOperationalDefaults(),
        security: defaultSecurityPrefs(),
        updatedAt: now,
      };

  const updated: PromoterPreferences = {
    ...existing,
    notifications: { ...existing.notifications, ...(patch.notifications ?? {}) },
    operationalDefaults: {
      ...existing.operationalDefaults,
      ...(patch.operationalDefaults ?? {}),
    },
    security: { ...existing.security, ...(patch.security ?? {}) },
    updatedAt: now,
  };

  await db.collection('promoter_preferences').doc(promoterId).set(updated, { merge: false });
  return updated;
}

// ── Verification ──────────────────────────────────────────────────────────────

export async function updateVerification(
  promoterId: string,
  fields: {
    govDocUrl?: string;
    selfieUrl?: string;
  },
): Promise<PromoterVerification> {
  const now = new Date().toISOString();

  if (!isFirebaseConfigured()) {
    const existing = _verification.get(promoterId) ?? {
      promoterId,
      status: 'UNVERIFIED' as VerificationStatus,
      govDocUrl: null,
      selfieUrl: null,
      rejectionReason: null,
      submittedAt: null,
      updatedAt: now,
    };
    // Transition to PENDING if at least one doc is present
    const updated: PromoterVerification = {
      ...existing,
      ...fields,
      promoterId,
      status: 'PENDING',
      submittedAt: now,
      updatedAt: now,
    };
    _verification.set(promoterId, updated);
    return updated;
  }

  const db = getAdminDb();
  const snap = await db.collection('promoter_verification').doc(promoterId).get();
  const existing: PromoterVerification = snap.exists
    ? (snap.data() as PromoterVerification)
    : {
        promoterId,
        status: 'UNVERIFIED',
        govDocUrl: null,
        selfieUrl: null,
        rejectionReason: null,
        submittedAt: null,
        updatedAt: now,
      };

  const updated: PromoterVerification = {
    ...existing,
    ...fields,
    promoterId,
    status: 'PENDING',
    submittedAt: now,
    updatedAt: now,
  };

  await db.collection('promoter_verification').doc(promoterId).set(updated, { merge: false });
  return updated;
}
