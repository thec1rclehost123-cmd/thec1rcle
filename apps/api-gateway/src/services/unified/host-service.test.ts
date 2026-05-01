import { describe, expect, it } from 'vitest';
import { HostService } from './host-service.js';
import { MockFirestore } from '../../test-utils/mock-firestore.js';

describe('HostService.getEvent', () => {
  it('returns null when the requesting host does not own the event', async () => {
    const db = new MockFirestore();
    db.seed('events/event_1', {
      title: 'Private Event',
      creatorId: 'host_owner',
      hostId: 'host_owner',
    });

    const service = new HostService(db as any);
    const event = await service.getEvent({
      partnerId: 'host_other',
      uid: 'user_1',
      type: 'host',
      roles: ['host_owner'],
      venueIds: [],
      displayName: 'Other Host',
    }, 'event_1');

    expect(event).toBeNull();
  });
});
