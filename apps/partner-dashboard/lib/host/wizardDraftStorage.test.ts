import { describe, expect, it, vi } from 'vitest';
import {
  buildWizardDraftStorageKey,
  migrateWizardDraftRecovery,
  removeWizardDraftRecovery,
} from './wizardDraftStorage';

describe('Host wizard recovery scope', () => {
  it('isolates recovery by user, persona, active membership, and event', () => {
    expect(
      buildWizardDraftStorageKey({
        uid: 'user-1',
        role: 'host',
        partnerId: 'host-1',
        eventId: 'event-1',
      }),
    ).toBe('c1rcle_draft_event_v2_user-1_host_host-1_event-1');
    expect(
      buildWizardDraftStorageKey({
        uid: 'user-1',
        role: 'venue',
        partnerId: 'venue-1',
        eventId: 'event-1',
      }),
    ).not.toBe('c1rcle_draft_event_v2_user-1_host_host-1_event-1');
  });

  it('refuses to persist recovery without an active membership', () => {
    expect(
      buildWizardDraftStorageKey({
        uid: 'user-1',
        role: 'host',
        partnerId: null,
        eventId: 'new',
      }),
    ).toBeNull();
  });

  it('moves the scoped new-event snapshot to the server draft id', () => {
    const values = new Map([['new-key', '{"title":"QA"}']]);
    const storage = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
      removeItem: vi.fn((key: string) => values.delete(key)),
    };

    migrateWizardDraftRecovery(storage, 'new-key', 'event-key');

    expect(values.get('event-key')).toBe('{"title":"QA"}');
    expect(values.has('new-key')).toBe(false);
  });

  it('removes each scoped key once on successful submission', () => {
    const storage = { removeItem: vi.fn() } as any;
    removeWizardDraftRecovery(storage, ['new-key', 'event-key', 'event-key', null]);
    expect(storage.removeItem).toHaveBeenCalledTimes(2);
    expect(storage.removeItem).toHaveBeenCalledWith('new-key');
    expect(storage.removeItem).toHaveBeenCalledWith('event-key');
  });
});
