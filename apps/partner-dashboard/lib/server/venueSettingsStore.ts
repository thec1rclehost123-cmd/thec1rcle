import { randomUUID } from 'node:crypto';
import { getAdminDb, isFirebaseConfigured } from '../firebase/admin';

export interface VenueNotificationPreferences {
  revenueUpdates: boolean;
  partnerRequests: boolean;
  securityAudit: boolean;
  productAnnouncements: boolean;
}

export interface VenueSecuritySettings {
  twoFactorEnabled: boolean;
  masterPasswordUpdatedAt: string | null;
}

export interface VenueSettings {
  venueId: string;
  adminEmail: string;
  supportHotline: string;
  operationalTimezone: string;
  primaryLanguage: string;
  bankAccountName: string;
  bankAccountMasked: string;
  settlementCadence: 'daily' | 'weekly' | 'monthly';
  notifications: VenueNotificationPreferences;
  security: VenueSecuritySettings;
  updatedAt: string;
  updatedBy: string | null;
  _version: number;
}

const fallbackSettings = new Map<string, VenueSettings>();

function defaultVenueSettings(venueId: string): VenueSettings {
  return {
    venueId,
    adminEmail: '',
    supportHotline: '',
    operationalTimezone: 'America/Phoenix',
    primaryLanguage: 'English (US)',
    bankAccountName: '',
    bankAccountMasked: '',
    settlementCadence: 'weekly',
    notifications: {
      revenueUpdates: true,
      partnerRequests: true,
      securityAudit: true,
      productAnnouncements: false,
    },
    security: {
      twoFactorEnabled: false,
      masterPasswordUpdatedAt: null,
    },
    updatedAt: new Date().toISOString(),
    updatedBy: null,
    _version: 0,
  };
}

export async function getVenueSettings(venueId: string): Promise<VenueSettings> {
  if (!isFirebaseConfigured()) {
    return fallbackSettings.get(venueId) ?? defaultVenueSettings(venueId);
  }

  const db = getAdminDb();
  const snap = await db.collection('venue_settings').doc(venueId).get();
  if (!snap.exists) return defaultVenueSettings(venueId);
  return { ...defaultVenueSettings(venueId), ...snap.data() } as VenueSettings;
}

export async function updateVenueSettings(
  venueId: string,
  patch: Partial<VenueSettings>,
  actor: { uid: string; displayName?: string },
): Promise<VenueSettings> {
  const now = new Date().toISOString();

  if (!isFirebaseConfigured()) {
    const current = fallbackSettings.get(venueId) ?? defaultVenueSettings(venueId);
    const updated = {
      ...current,
      ...patch,
      notifications: { ...current.notifications, ...(patch.notifications ?? {}) },
      security: { ...current.security, ...(patch.security ?? {}) },
      updatedAt: now,
      updatedBy: actor.uid,
      _version: current._version + 1,
    };
    fallbackSettings.set(venueId, updated);
    return updated;
  }

  const db = getAdminDb();
  const ref = db.collection('venue_settings').doc(venueId);
  const current = await getVenueSettings(venueId);
  const updated = {
    ...current,
    ...patch,
    notifications: { ...current.notifications, ...(patch.notifications ?? {}) },
    security: { ...current.security, ...(patch.security ?? {}) },
    updatedAt: now,
    updatedBy: actor.uid,
    _version: current._version + 1,
  };

  await ref.set(updated, { merge: false });

  await db
    .collection('audit_logs')
    .doc(randomUUID())
    .set({
      action: 'VENUE_SETTINGS_UPDATED',
      targetId: venueId,
      uid: actor.uid,
      actorName: actor.displayName ?? actor.uid,
      diff: patch,
      createdAt: now,
    });

  return updated;
}
