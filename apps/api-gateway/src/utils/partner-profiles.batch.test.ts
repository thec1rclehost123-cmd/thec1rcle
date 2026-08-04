import { describe, expect, it, vi } from 'vitest';
import { MockFirestore } from '../test-utils/mock-firestore.js';
import { getPartnerProfileSummariesById } from './partner-profiles.js';

vi.mock('../lib/signed-urls.js', () => ({
  signStorageUrl: async (value: string) => value || null,
}));

describe('getPartnerProfileSummariesById', () => {
  it('resolves canonical partner documents in Firestore-safe chunks', async () => {
    const db = new MockFirestore();
    const ids: string[] = [];
    for (let index = 1; index <= 35; index += 1) {
      const id = `venue_${index}`;
      ids.push(id);
      db.seed(`venues/${id}`, {
        displayName: `Venue ${index}`,
        city: 'Mumbai',
        status: 'active',
      });
    }

    const profiles = await getPartnerProfileSummariesById(db as any, ids);

    expect(profiles).toHaveLength(35);
    expect(profiles.get('venue_35')).toMatchObject({
      id: 'venue_35',
      type: 'venue',
      name: 'Venue 35',
      city: 'Mumbai',
      isVerified: true,
    });
  });

  it('batches unresolved user-id fallbacks without exposing PII', async () => {
    const db = new MockFirestore();
    db.seed('users/user_1', {
      displayName: 'Fallback Host',
      role: 'host',
      email: 'private@example.com',
      phoneNumber: '+910000000000',
    });

    const profiles = await getPartnerProfileSummariesById(db as any, ['user_1']);

    expect(profiles.get('user_1')).toMatchObject({
      id: 'user_1',
      type: 'host',
      name: 'Fallback Host',
    });
    expect(profiles.get('user_1')).not.toHaveProperty('email');
    expect(profiles.get('user_1')).not.toHaveProperty('phone');
  });
});
