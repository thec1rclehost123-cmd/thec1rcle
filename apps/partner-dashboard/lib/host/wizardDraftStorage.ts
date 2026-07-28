type DraftStorageScope = {
  uid?: string | null;
  role: 'host' | 'venue';
  partnerId?: string | null;
  eventId?: string | null;
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function buildWizardDraftStorageKey({
  uid,
  role,
  partnerId,
  eventId,
}: DraftStorageScope): string | null {
  if (!uid || !partnerId) return null;
  const normalizedEventId = eventId || 'new';
  return ['c1rcle_draft_event_v2', uid, role, partnerId, normalizedEventId]
    .map((value) => encodeURIComponent(value))
    .join('_');
}

export function migrateWizardDraftRecovery(
  storage: StorageLike,
  fromKey: string | null,
  toKey: string | null,
): void {
  if (!fromKey || !toKey || fromKey === toKey) return;
  const recovery = storage.getItem(fromKey);
  if (recovery !== null) storage.setItem(toKey, recovery);
  storage.removeItem(fromKey);
}

export function removeWizardDraftRecovery(
  storage: StorageLike,
  keys: Array<string | null | undefined>,
): void {
  for (const key of new Set(keys.filter((value): value is string => Boolean(value)))) {
    storage.removeItem(key);
  }
}
