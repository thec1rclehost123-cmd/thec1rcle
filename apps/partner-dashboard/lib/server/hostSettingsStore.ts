/**
 * Host Settings Store — server-side Firestore operations
 *
 * Collections:
 *   host_settings/{hostId}                      — main settings document
 *   host_audit_log/{hostId}/entries/{entryId}   — immutable audit trail subcollection
 *   host_login_sessions/{hostId}/sessions/{id}  — active session records
 */

import { randomUUID } from "node:crypto";
import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";

// ── Types ─────────────────────────────────────────────────────────────────────

export type HostSettingsAction =
    | "GENERAL_UPDATED"
    | "FINANCIAL_UPDATED"
    | "NOTIFICATIONS_UPDATED"
    | "DEFAULTS_UPDATED"
    | "INTEGRATION_CONNECTED"
    | "INTEGRATION_DISCONNECTED"
    | "ORGANIZATION_DEACTIVATED";

export type HostSettingsSection =
    | "general" | "security" | "financials" | "alerts"
    | "defaults" | "integrations" | "auditlog";

export interface HostSettings {
    hostId: string;
    // General
    orgName: string;
    supportEmail: string;
    legalPhone: string;
    website: string;
    logoUrl: string | null;
    defaultTimezone: string;
    defaultCurrency: string;
    status: "active" | "archived";
    // Financials (never store full account number here)
    bankAccountMasked: string | null;
    upiId: string | null;
    settlementFrequency: "weekly" | "biweekly" | "monthly";
    // Alerts — flat map: `{category}_{channel}` e.g. slotApproved_email
    notificationPreferences: Record<string, boolean>;
    // Defaults
    defaultTaxRate: number;
    defaultEventVisibility: "public" | "private" | "invite_only";
    // Integrations
    googleCalendarConnected: boolean;
    googleCalendarEmail: string | null;
    analyticsEnabled: boolean;
    crmConnected: boolean;
    // Meta
    updatedAt: string;
    updatedBy: string | null;
    _version: number;
}

export interface AuditLogEntry {
    id: string;
    hostId: string;
    actorId: string;
    actorName: string;
    actionType: HostSettingsAction;
    section: HostSettingsSection;
    oldValue: Record<string, unknown>;
    newValue: Record<string, unknown>;
    createdAt: string;
}

export interface LoginSession {
    sessionId: string;
    hostId: string;
    userId: string;
    userAgent: string | null;
    deviceType: "desktop" | "mobile" | "unknown";
    lastActiveAt: string;
    createdAt: string;
    isRevoked: boolean;
    revokedAt: string | null;
}

export interface ActorContext {
    uid: string;
    displayName: string;
    ip?: string;
}

// ── Default settings factory ───────────────────────────────────────────────────

function defaultSettings(hostId: string): HostSettings {
    return {
        hostId,
        orgName: "",
        supportEmail: "",
        legalPhone: "",
        website: "",
        logoUrl: null,
        defaultTimezone: "Asia/Kolkata",
        defaultCurrency: "INR",
        status: "active",
        bankAccountMasked: null,
        upiId: null,
        settlementFrequency: "weekly",
        notificationPreferences: {
            slotApproved_email: true, slotApproved_push: true, slotApproved_sms: false,
            slotRejected_email: true, slotRejected_push: true, slotRejected_sms: false,
            eventReminder_email: true, eventReminder_push: true, eventReminder_sms: false,
            promoterRequest_email: true, promoterRequest_push: true, promoterRequest_sms: false,
            newFollower_email: false, newFollower_push: true, newFollower_sms: false,
            weeklyDigest_email: true, weeklyDigest_push: false, weeklyDigest_sms: false,
        },
        defaultTaxRate: 0,
        defaultEventVisibility: "public",
        googleCalendarConnected: false,
        googleCalendarEmail: null,
        analyticsEnabled: true,
        crmConnected: false,
        updatedAt: new Date().toISOString(),
        updatedBy: null,
        _version: 0,
    };
}

// ── In-memory fallback (dev without Firebase) ──────────────────────────────────

const _settings = new Map<string, HostSettings>();
const _auditLog = new Map<string, AuditLogEntry[]>();
const _sessions = new Map<string, LoginSession[]>();

// ── Sensitive field masking ────────────────────────────────────────────────────

const SENSITIVE_KEYS = new Set(["bankAccountMasked", "upiId"]);

function maskSensitiveFields(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
        result[k] = SENSITIVE_KEYS.has(k) ? "[REDACTED]" : v;
    }
    return result;
}

function pick<T extends object>(obj: T, keys: string[]): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    for (const k of keys) {
        if (k in obj) result[k] = (obj as Record<string, unknown>)[k];
    }
    return result;
}

// ── getHostSettings ─────────────────────────────────────────────────────────────

export async function getHostSettings(hostId: string): Promise<HostSettings> {
    if (!isFirebaseConfigured()) {
        return _settings.get(hostId) ?? defaultSettings(hostId);
    }
    const db = getAdminDb();
    const snap = await db.collection("host_settings").doc(hostId).get();
    if (!snap.exists) return defaultSettings(hostId);
    return { ...defaultSettings(hostId), ...snap.data() } as HostSettings;
}

// ── updateHostSettings ──────────────────────────────────────────────────────────

export async function updateHostSettings(
    hostId: string,
    patch: Partial<HostSettings>,
    actor: ActorContext,
    action: HostSettingsAction,
    section: HostSettingsSection
): Promise<HostSettings> {
    const now = new Date().toISOString();
    const entryId = randomUUID();

    if (!isFirebaseConfigured()) {
        const current = _settings.get(hostId) ?? defaultSettings(hostId);
        const oldValue = maskSensitiveFields(pick(current, Object.keys(patch)));
        const updated: HostSettings = {
            ...current,
            ...patch,
            updatedAt: now,
            updatedBy: actor.uid,
            _version: current._version + 1,
        };
        const newValue = maskSensitiveFields(pick(updated, Object.keys(patch)));
        const entry: AuditLogEntry = {
            id: entryId, hostId, actorId: actor.uid, actorName: actor.displayName,
            actionType: action, section, oldValue, newValue, createdAt: now,
        };
        _settings.set(hostId, updated);
        const log = _auditLog.get(hostId) ?? [];
        _auditLog.set(hostId, [entry, ...log]);
        return updated;
    }

    const db = getAdminDb();
    const settingsRef = db.collection("host_settings").doc(hostId);
    const auditRef = db.collection("host_audit_log").doc(hostId).collection("entries").doc(entryId);

    // Read current to capture oldValue for audit
    const snap = await settingsRef.get();
    const current: HostSettings = snap.exists
        ? { ...defaultSettings(hostId), ...snap.data() } as HostSettings
        : defaultSettings(hostId);

    const oldValue = maskSensitiveFields(pick(current, Object.keys(patch)));
    const updated: HostSettings = {
        ...current,
        ...patch,
        updatedAt: now,
        updatedBy: actor.uid,
        _version: current._version + 1,
    };
    const newValue = maskSensitiveFields(pick(updated, Object.keys(patch)));

    const auditEntry: AuditLogEntry = {
        id: entryId, hostId, actorId: actor.uid, actorName: actor.displayName,
        actionType: action, section, oldValue, newValue, createdAt: now,
    };

    // Atomic batch: write audit entry THEN update settings
    const batch = db.batch();
    batch.set(auditRef, auditEntry);
    batch.set(settingsRef, updated, { merge: false });
    await batch.commit();

    return updated;
}

// ── getAuditLog ────────────────────────────────────────────────────────────────

export async function getAuditLog(
    hostId: string,
    limit = 50,
    cursor?: string
): Promise<{ entries: AuditLogEntry[]; hasMore: boolean; nextCursor: string | null }> {
    if (!isFirebaseConfigured()) {
        const all = _auditLog.get(hostId) ?? [];
        const sliced = all.slice(0, limit);
        return { entries: sliced, hasMore: all.length > limit, nextCursor: null };
    }

    const db = getAdminDb();
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    let q = db
        .collection("host_audit_log").doc(hostId).collection("entries")
        .where("createdAt", ">=", ninetyDaysAgo)
        .orderBy("createdAt", "desc")
        .limit(limit + 1);

    if (cursor) {
        const cursorSnap = await db
            .collection("host_audit_log").doc(hostId).collection("entries").doc(cursor).get();
        if (cursorSnap.exists) q = q.startAfter(cursorSnap);
    }

    const snap = await q.get();
    const entries = snap.docs.slice(0, limit).map((d: any) => d.data() as AuditLogEntry);
    const hasMore = snap.docs.length > limit;
    const nextCursor = hasMore ? snap.docs[limit - 1].id : null;
    return { entries, hasMore, nextCursor };
}

// ── writeLoginSession ──────────────────────────────────────────────────────────

export async function writeLoginSession(
    hostId: string,
    userId: string,
    data: Pick<LoginSession, "userAgent" | "deviceType" | "lastActiveAt"> & { sessionId: string }
): Promise<LoginSession> {
    const now = new Date().toISOString();
    const session: LoginSession = {
        sessionId: data.sessionId,
        hostId,
        userId,
        userAgent: data.userAgent,
        deviceType: data.deviceType,
        lastActiveAt: data.lastActiveAt,
        createdAt: now,
        isRevoked: false,
        revokedAt: null,
    };

    if (!isFirebaseConfigured()) {
        const existing = _sessions.get(hostId) ?? [];
        _sessions.set(hostId, [session, ...existing.filter(s => s.sessionId !== session.sessionId)]);
        return session;
    }

    const db = getAdminDb();
    await db.collection("host_login_sessions").doc(hostId)
        .collection("sessions").doc(session.sessionId).set(session);
    return session;
}

// ── getLoginSessions ───────────────────────────────────────────────────────────

export async function getLoginSessions(
    hostId: string,
    userId: string
): Promise<LoginSession[]> {
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    if (!isFirebaseConfigured()) {
        const all = _sessions.get(hostId) ?? [];
        return all.filter(
            s => s.userId === userId && !s.isRevoked && s.lastActiveAt >= sevenDaysAgo
        );
    }

    const db = getAdminDb();
    const snap = await db
        .collection("host_login_sessions").doc(hostId).collection("sessions")
        .where("userId", "==", userId)
        .where("isRevoked", "==", false)
        .where("lastActiveAt", ">=", sevenDaysAgo)
        .orderBy("lastActiveAt", "desc")
        .limit(20)
        .get();

    return snap.docs.map((d: any) => d.data() as LoginSession);
}

// ── revokeLoginSession ─────────────────────────────────────────────────────────

export async function revokeLoginSession(
    hostId: string,
    sessionId: string
): Promise<void> {
    const now = new Date().toISOString();

    if (!isFirebaseConfigured()) {
        const existing = _sessions.get(hostId) ?? [];
        _sessions.set(
            hostId,
            existing.map(s =>
                s.sessionId === sessionId ? { ...s, isRevoked: true, revokedAt: now } : s
            )
        );
        return;
    }

    const db = getAdminDb();
    await db.collection("host_login_sessions").doc(hostId)
        .collection("sessions").doc(sessionId)
        .update({ isRevoked: true, revokedAt: now });
}

// ── deactivateOrganization ─────────────────────────────────────────────────────

export async function deactivateOrganization(
    hostId: string,
    actor: ActorContext
): Promise<void> {
    await updateHostSettings(
        hostId,
        { status: "archived" },
        actor,
        "ORGANIZATION_DEACTIVATED",
        "general"
    );
}
