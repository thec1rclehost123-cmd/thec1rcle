/**
 * Staff Profile Store — server-side Firestore operations
 * Venue Dashboard v2 — Feature 1
 *
 * Collections:
 *   venues/{venueId}/staff_profiles/{profileId}
 *   staff_profile_audit/{entryId}           (write-only audit log)
 *   partner_memberships/{membershipId}      (extended with staffProfileId)
 */

import { randomUUID } from "node:crypto";
import { getAdminDb, isFirebaseConfigured } from "../firebase/admin";
import type {
    StaffProfile,
    StaffAction,
    VenueTab,
    PIIPolicy,
    GuestlistScope,
    StaffProfileAuditEntry,
    VenueRole,
} from "../types/staffProfile";
import {
    DEFAULT_PII_POLICY,
    OWNER_PII_POLICY,
    ROLE_DEFAULT_TABS,
} from "../types/staffProfile";

// ── Fallback store (dev only) ─────────────────────────────────────────────────
const _profiles = new Map<string, StaffProfile>();

// ── Helpers ───────────────────────────────────────────────────────────────────
function profilesRef(venueId: string) {
    if (!venueId || venueId === "null" || venueId === "undefined") {
        throw new Error("venueId is required");
    }
    return getAdminDb().collection("venues").doc(venueId).collection("staff_profiles");
}

function auditRef() {
    return getAdminDb().collection("staff_profile_audit");
}

async function writeAudit(entry: Omit<StaffProfileAuditEntry, "id" | "createdAt">) {
    if (!isFirebaseConfigured()) return;
    const db = getAdminDb();
    const id = randomUUID();
    await db.collection("staff_profile_audit").doc(id).set({
        ...entry,
        id,
        createdAt: new Date().toISOString(),
    });
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function createStaffProfile(
    venueId: string,
    payload: {
        profileName: string;
        baseRole: VenueRole;
        tabVisibility?: Partial<Record<VenueTab, boolean>>;
        actionPermissions?: Partial<Record<StaffAction, boolean>>;
        piiPolicy?: Partial<PIIPolicy>;
        eventScope?: string[] | null;
        guestlistScope?: GuestlistScope;
    },
    actor: { uid: string; name: string }
): Promise<StaffProfile> {
    const id = randomUUID();
    const now = new Date().toISOString();

    const basePii: PIIPolicy =
        payload.baseRole === "OWNER"
            ? OWNER_PII_POLICY
            : { ...DEFAULT_PII_POLICY };

    const profile: StaffProfile = {
        id,
        venueId,
        profileName: payload.profileName.trim(),
        baseRole: payload.baseRole,
        tabVisibility:
            payload.tabVisibility ?? (ROLE_DEFAULT_TABS[payload.baseRole] as any),
        actionPermissions: payload.actionPermissions ?? {},
        piiPolicy: { ...basePii, ...(payload.piiPolicy ?? {}) },
        eventScope: payload.eventScope ?? null,
        guestlistScope: payload.guestlistScope ?? "read_only",
        isActive: true,
        createdBy: actor.uid,
        updatedBy: actor.uid,
        createdAt: now,
        updatedAt: now,
    };

    if (!isFirebaseConfigured()) {
        _profiles.set(id, profile);
        return profile;
    }

    await profilesRef(venueId).doc(id).set(profile);
    await writeAudit({
        venueId,
        profileId: id,
        action: "created",
        actorUid: actor.uid,
        actorName: actor.name,
        diff: { profileName: { before: null, after: profile.profileName } },
    });

    return profile;
}

export async function getStaffProfile(
    venueId: string,
    profileId: string
): Promise<StaffProfile | null> {
    if (!isFirebaseConfigured()) {
        return _profiles.get(profileId) ?? null;
    }

    const doc = await profilesRef(venueId).doc(profileId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() } as StaffProfile;
}

export async function listStaffProfiles(venueId: string): Promise<StaffProfile[]> {
    if (!isFirebaseConfigured()) {
        return Array.from(_profiles.values()).filter((p) => p.venueId === venueId);
    }

    const snap = await profilesRef(venueId).where("isActive", "==", true).get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as StaffProfile));
}

export async function updateStaffProfile(
    venueId: string,
    profileId: string,
    updates: Partial<
        Pick<
            StaffProfile,
            | "profileName"
            | "tabVisibility"
            | "actionPermissions"
            | "piiPolicy"
            | "eventScope"
            | "guestlistScope"
            | "isActive"
        >
    >,
    actor: { uid: string; name: string }
): Promise<StaffProfile> {
    const existing = await getStaffProfile(venueId, profileId);
    if (!existing) throw new Error("Staff profile not found");

    const now = new Date().toISOString();
    const merged: StaffProfile = {
        ...existing,
        ...updates,
        updatedBy: actor.uid,
        updatedAt: now,
    };

    if (!isFirebaseConfigured()) {
        _profiles.set(profileId, merged);
        return merged;
    }

    const diff: Record<string, { before: unknown; after: unknown }> = {};
    for (const k of Object.keys(updates) as (keyof typeof updates)[]) {
        if (JSON.stringify(existing[k]) !== JSON.stringify(updates[k])) {
            diff[k] = { before: existing[k], after: updates[k] };
        }
    }

    await profilesRef(venueId).doc(profileId).update({ ...updates, updatedBy: actor.uid, updatedAt: now });
    await writeAudit({
        venueId,
        profileId,
        action: "updated",
        actorUid: actor.uid,
        actorName: actor.name,
        diff,
    });

    return merged;
}

export async function deleteStaffProfile(
    venueId: string,
    profileId: string,
    actor: { uid: string; name: string }
): Promise<void> {
    if (!isFirebaseConfigured()) {
        _profiles.delete(profileId);
        return;
    }

    // Soft-delete: set isActive = false
    await profilesRef(venueId).doc(profileId).update({
        isActive: false,
        updatedBy: actor.uid,
        updatedAt: new Date().toISOString(),
    });

    await writeAudit({
        venueId,
        profileId,
        action: "deleted",
        actorUid: actor.uid,
        actorName: actor.name,
    });
}

// ── Assignment: attach profile to a membership ────────────────────────────────

export async function assignProfileToMember(
    venueId: string,
    membershipId: string,
    profileId: string,
    actor: { uid: string; name: string }
): Promise<void> {
    if (!isFirebaseConfigured()) return;

    const db = getAdminDb();
    await db.collection("partner_memberships").doc(membershipId).update({
        staffProfileId: profileId,
        updatedAt: new Date().toISOString(),
    });

    await writeAudit({
        venueId,
        profileId,
        action: "assigned",
        actorUid: actor.uid,
        actorName: actor.name,
        targetUid: membershipId,
    });
}

export async function revokeProfileFromMember(
    venueId: string,
    membershipId: string,
    actor: { uid: string; name: string }
): Promise<void> {
    if (!isFirebaseConfigured()) return;

    const db = getAdminDb();
    const snap = await db.collection("partner_memberships").doc(membershipId).get();
    const prevProfileId = snap.data()?.staffProfileId ?? null;

    await db.collection("partner_memberships").doc(membershipId).update({
        staffProfileId: null,
        updatedAt: new Date().toISOString(),
    });

    if (prevProfileId) {
        await writeAudit({
            venueId,
            profileId: prevProfileId,
            action: "revoked",
            actorUid: actor.uid,
            actorName: actor.name,
            targetUid: membershipId,
        });
    }
}

// ── Resolve: get effective permissions for a member ───────────────────────────

export async function resolveEffectiveProfile(
    venueId: string,
    membershipId: string
): Promise<{
    baseRole: VenueRole;
    tabVisibility: Partial<Record<VenueTab, boolean>>;
    actionPermissions: Partial<Record<StaffAction, boolean>>;
    piiPolicy: PIIPolicy;
    guestlistScope: GuestlistScope;
    eventScope: string[] | null;
}> {
    if (!isFirebaseConfigured()) {
        return {
            baseRole: "STAFF",
            tabVisibility: ROLE_DEFAULT_TABS["STAFF"],
            actionPermissions: {},
            piiPolicy: DEFAULT_PII_POLICY,
            guestlistScope: "read_only",
            eventScope: null,
        };
    }

    const db = getAdminDb();
    const memberDoc = await db.collection("partner_memberships").doc(membershipId).get();
    if (!memberDoc.exists) throw new Error("Membership not found");

    const data = memberDoc.data()!;
    const baseRole: VenueRole = (data.role as VenueRole) ?? "STAFF";

    // If a custom profile is assigned, it wins
    if (data.staffProfileId) {
        try {
            const profile = await getStaffProfile(venueId, data.staffProfileId);
            if (profile && profile.isActive) {
                return {
                    baseRole: profile.baseRole,
                    tabVisibility: profile.tabVisibility,
                    actionPermissions: profile.actionPermissions,
                    piiPolicy: profile.piiPolicy,
                    guestlistScope: profile.guestlistScope,
                    eventScope: profile.eventScope,
                };
            }
        } catch {
            // stale or invalid staffProfileId — fall through to role defaults
        }
    }

    // Fall back to role defaults
    const pii = baseRole === "OWNER" ? OWNER_PII_POLICY : DEFAULT_PII_POLICY;
    return {
        baseRole,
        tabVisibility: ROLE_DEFAULT_TABS[baseRole] ?? {},
        actionPermissions: {},
        piiPolicy: pii,
        guestlistScope: baseRole === "OWNER" || baseRole === "MANAGER" ? "editable" : "read_only",
        eventScope: null,
    };
}

// ── Audit log retrieval ────────────────────────────────────────────────────────

export async function listProfileAudit(
    venueId: string,
    profileId?: string,
    limit = 50
): Promise<StaffProfileAuditEntry[]> {
    if (!isFirebaseConfigured()) return [];

    const db = getAdminDb();
    let q = db
        .collection("staff_profile_audit")
        .where("venueId", "==", venueId)
        .orderBy("createdAt", "desc")
        .limit(limit);

    if (profileId) {
        q = db
            .collection("staff_profile_audit")
            .where("venueId", "==", venueId)
            .where("profileId", "==", profileId)
            .orderBy("createdAt", "desc")
            .limit(limit);
    }

    const snap = await q.get();
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as StaffProfileAuditEntry));
}
